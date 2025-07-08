const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const EventEmitter = require('events');
const PlatformDetector = require('./platform-detector');
const ConfigLoader = require('./config-loader');

/**
 * 汎用mkcert証明書管理クラス
 * Windows、macOS、Linux対応
 */
class CertificateManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = ConfigLoader.load(options);
        this.platform = PlatformDetector.detect();
        this.isMonitoring = false;
        this.watcher = null;
        this.cronTask = null; // cronタスクを追跡
        
        // プラットフォーム固有の設定
        this.mkcertCommand = this.platform.isWindows ? 'mkcert.exe' : 'mkcert';
        this.certPath = path.resolve(this.config.certPath || process.cwd());
        this.certName = this.config.certName || 'localhost+3';
        
        this.certFile = path.join(this.certPath, `${this.certName}.pem`);
        this.keyFile = path.join(this.certPath, `${this.certName}-key.pem`);
        
        this.emit('initialized', { platform: this.platform, config: this.config });
    }

    /**
     * mkcertがインストールされているかチェック
     */
    async checkMkcertInstalled() {
        return new Promise((resolve) => {
            const cmd = this.platform.isWindows ? 'where' : 'which';
            const proc = spawn(cmd, [this.mkcertCommand], { shell: true });
            
            proc.on('close', (code) => {
                resolve(code === 0);
            });
        });
    }

    /**
     * 証明書の有効期限を取得
     */
    async getCertificateExpiry() {
        if (!await fs.pathExists(this.certFile)) {
            return null;
        }

        try {
            const certData = await fs.readFile(this.certFile);
            
            if (this.platform.isWindows) {
                // WindowsでOpenSSLを使用して証明書情報を取得
                return await this.getExpiryWindows(certData);
            } else {
                // Unix系でopensslコマンドを使用
                return await this.getExpiryUnix(certData);
            }
        } catch (error) {
            this.emit('error', new Error(`証明書の解析に失敗: ${error.message}`));
            return null;
        }
    }

    /**
     * Windows用証明書有効期限取得
     */
    async getExpiryWindows(certData) {
        return new Promise((resolve, reject) => {
            const proc = spawn('powershell', [
                '-Command',
                `$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList @([byte[]]([System.Convert]::FromBase64String((Get-Content "${this.certFile}" | Select-String -Pattern "-----" -NotMatch | Out-String).Trim()))); $cert.NotAfter.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")`
            ], { shell: true });
            
            let output = '';
            proc.stdout.on('data', (data) => output += data.toString());
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(new Date(output.trim()));
                } else {
                    reject(new Error('PowerShell証明書解析エラー'));
                }
            });
        });
    }

    /**
     * Unix系用証明書有効期限取得
     */
    async getExpiryUnix(certData) {
        return new Promise((resolve, reject) => {
            const proc = spawn('openssl', ['x509', '-noout', '-enddate'], { shell: true });
            
            proc.stdin.write(certData);
            proc.stdin.end();
            
            let output = '';
            proc.stdout.on('data', (data) => output += data.toString());
            proc.on('close', (code) => {
                if (code === 0) {
                    const match = output.match(/notAfter=(.+)/);
                    if (match) {
                        resolve(new Date(match[1]));
                    } else {
                        reject(new Error('証明書の有効期限を解析できませんでした'));
                    }
                } else {
                    reject(new Error('openssl証明書解析エラー'));
                }
            });
        });
    }

    /**
     * 証明書が更新が必要かチェック
     */
    async needsRenewal(warningDays = 10) {
        const expiry = await this.getCertificateExpiry();
        if (!expiry) return true;
        
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        
        this.emit('expiry-check', { expiry, daysUntilExpiry, needsRenewal: daysUntilExpiry <= warningDays });
        
        return daysUntilExpiry <= warningDays;
    }

    /**
     * 証明書を生成・更新
     */
    async generateCertificate(domains = ['localhost', '127.0.0.1', '::1']) {
        if (!await this.checkMkcertInstalled()) {
            throw new Error('mkcertがインストールされていません');
        }

        // 既存証明書をバックアップ
        await this.backupExistingCertificates();

        // 証明書ディレクトリを作成
        await fs.ensureDir(this.certPath);

        const args = [
            '-key-file', this.keyFile,
            '-cert-file', this.certFile,
            ...domains
        ];

        this.emit('generating', { domains, certPath: this.certPath });

        return new Promise((resolve, reject) => {
            const proc = spawn(this.mkcertCommand, args, {
                cwd: this.certPath,
                shell: this.platform.isWindows
            });

            let output = '';
            let errorOutput = '';

            proc.stdout.on('data', (data) => {
                output += data.toString();
                this.emit('generation-progress', data.toString());
            });

            proc.stderr.on('data', (data) => {
                errorOutput += data.toString();
                this.emit('generation-progress', data.toString());
            });

            proc.on('close', async (code) => {
                if (code === 0) {
                    this.emit('generated', {
                        certFile: this.certFile,
                        keyFile: this.keyFile,
                        output
                    });
                    resolve({ success: true, certFile: this.certFile, keyFile: this.keyFile });
                } else {
                    const error = new Error(`mkcert実行エラー (code: ${code}): ${errorOutput}`);
                    this.emit('error', error);
                    reject(error);
                }
            });
        });
    }

    /**
     * 既存証明書をバックアップ
     */
    async backupExistingCertificates() {
        if (!await fs.pathExists(this.certFile)) return;

        const backupDir = path.join(this.certPath, 'backup');
        await fs.ensureDir(backupDir);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupCertFile = path.join(backupDir, `${this.certName}-${timestamp}.pem`);
        const backupKeyFile = path.join(backupDir, `${this.certName}-${timestamp}-key.pem`);

        await fs.copy(this.certFile, backupCertFile);
        await fs.copy(this.keyFile, backupKeyFile);

        this.emit('backup-created', { backupCertFile, backupKeyFile });
    }

    /**
     * 証明書ファイルの変更を監視
     */
    startMonitoring(callback) {
        if (this.isMonitoring) {
            throw new Error('既に監視中です');
        }

        this.isMonitoring = true;
        this.watcher = chokidar.watch([this.certFile, this.keyFile], {
            persistent: true,
            ignoreInitial: true
        });

        this.watcher.on('change', (filePath) => {
            this.emit('certificate-changed', { filePath, timestamp: new Date() });
            if (callback) callback(filePath);
        });

        this.emit('monitoring-started', { certFile: this.certFile, keyFile: this.keyFile });
    }

    /**
     * 監視を停止
     */
    stopMonitoring() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.isMonitoring = false;
        this.emit('monitoring-stopped');
    }

    /**
     * 定期的な証明書チェック・更新
     */
    scheduleAutoRenewal(cronPattern = '0 2 * * 0', domains) {
        const cron = require('node-cron');
        
        // 既存のタスクがあれば停止
        if (this.cronTask) {
            this.cronTask.stop();
            this.cronTask = null;
        }
        
        this.cronTask = cron.schedule(cronPattern, async () => {
            try {
                if (await this.needsRenewal()) {
                    this.emit('auto-renewal-triggered');
                    await this.generateCertificate(domains);
                    this.emit('auto-renewal-completed');
                }
            } catch (error) {
                this.emit('auto-renewal-failed', error);
            }
        }, {
            scheduled: false
        });

        this.emit('auto-renewal-scheduled', { cronPattern });
        this.cronTask.start();
        
        return this.cronTask;
    }

    /**
     * 自動更新スケジュールを停止
     */
    stopAutoRenewal() {
        if (this.cronTask) {
            this.cronTask.stop();
            this.cronTask = null;
            this.emit('auto-renewal-stopped');
        }
    }

    /**
     * Express.js統合用のミドルウェア
     */
    expressMiddleware() {
        return (req, res, next) => {
            // 証明書情報をレスポンスヘッダーに追加
            this.getCertificateExpiry().then(expiry => {
                if (expiry) {
                    res.setHeader('X-Cert-Expiry', expiry.toISOString());
                }
                next();
            }).catch(() => next());
        };
    }

    /**
     * リソースクリーンアップ
     */
    destroy() {
        this.stopMonitoring();
        this.stopAutoRenewal();
        this.removeAllListeners();
        console.log('🧹 CertificateManager: リソースをクリーンアップしました');
    }
}

module.exports = CertificateManager;