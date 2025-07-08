const CertificateManager = require('./certificate-manager');
const ProjectIntegrator = require('./project-integrator');
const EventEmitter = require('events');

/**
 * mkcert証明書自動更新システム - メインAPI
 * Express.js、Webpack Dev Server、その他のNode.jsプロジェクトで使用
 */
class MkcertAutoRenewer extends EventEmitter {
    constructor(options = {}) {
        super();
        this.manager = new CertificateManager(options);
        this.integrator = new ProjectIntegrator(this.manager);
        
        // イベントのプロキシ
        this.manager.on('generated', (...args) => this.emit('generated', ...args));
        this.manager.on('error', (...args) => this.emit('error', ...args));
        this.manager.on('certificate-changed', (...args) => this.emit('certificate-changed', ...args));
        this.manager.on('monitoring-started', (...args) => this.emit('monitoring-started', ...args));
        this.manager.on('monitoring-stopped', (...args) => this.emit('monitoring-stopped', ...args));
        this.manager.on('auto-renewal-triggered', (...args) => this.emit('auto-renewal-triggered', ...args));
        this.manager.on('auto-renewal-completed', (...args) => this.emit('auto-renewal-completed', ...args));
        this.manager.on('auto-renewal-failed', (...args) => this.emit('auto-renewal-failed', ...args));
    }

    /**
     * 証明書の即座生成・更新
     */
    async generate(domains = ['localhost', '127.0.0.1', '::1']) {
        return this.manager.generateCertificate(domains);
    }

    /**
     * 証明書の有効期限チェック
     */
    async checkExpiry() {
        return this.manager.getCertificateExpiry();
    }

    /**
     * 更新が必要かチェック
     */
    async needsRenewal(warningDays = 10) {
        return this.manager.needsRenewal(warningDays);
    }

    /**
     * ファイル監視開始
     */
    startWatching(callback) {
        return this.manager.startMonitoring(callback);
    }

    /**
     * 監視停止
     */
    stopWatching() {
        return this.manager.stopMonitoring();
    }

    /**
     * 自動更新スケジュール設定
     */
    scheduleAutoRenewal(cronPattern = '0 2 * * 0', domains) {
        return this.manager.scheduleAutoRenewal(cronPattern, domains);
    }

    /**
     * 自動更新スケジュール停止
     */
    stopAutoRenewal() {
        return this.manager.stopAutoRenewal();
    }

    /**
     * Express.js用HTTPS設定取得
     */
    async getExpressHttpsOptions() {
        return this.integrator.getExpressHttpsOptions();
    }

    /**
     * Webpack Dev Server設定取得
     */
    async getWebpackDevServerConfig() {
        return this.integrator.getWebpackDevServerConfig();
    }

    /**
     * Next.js設定取得
     */
    async getNextJsConfig() {
        return this.integrator.getNextJsConfig();
    }

    /**
     * 証明書変更時のホットリロード設定
     */
    setupHotReload(reloadCallback) {
        return this.integrator.setupHotReload(reloadCallback);
    }

    /**
     * 統合設定ファイルの生成
     */
    async generateIntegrationConfig(projectType = 'express') {
        return this.integrator.generateIntegrationConfig(projectType);
    }

    /**
     * Express.js統合用のミドルウェア
     */
    expressMiddleware() {
        return this.manager.expressMiddleware();
    }

    /**
     * mkcert依存関係のインストール
     */
    async installDependencies() {
        const platform = this.manager.platform;
        const { spawn } = require('child_process');
        
        let command, args;
        
        if (platform.isWindows) {
            // Windows: Chocolatey経由でインストール
            command = 'powershell';
            args = ['-Command', 'choco install mkcert'];
        } else if (platform.isMacOS) {
            // macOS: Homebrew経由でインストール
            command = 'brew';
            args = ['install', 'mkcert'];
        } else {
            // Linux: 手動インストール手順を表示
            return {
                success: false,
                error: 'Linux環境では手動インストールが必要です',
                instructions: [
                    '1. https://github.com/FiloSottile/mkcert/releases から最新版をダウンロード',
                    '2. バイナリを /usr/local/bin/ に配置',
                    '3. chmod +x /usr/local/bin/mkcert で実行権限を付与',
                    '4. mkcert -install でルート証明書をインストール'
                ]
            };
        }

        return new Promise((resolve) => {
            const proc = spawn(command, args, { shell: true });
            
            let output = '';
            proc.stdout.on('data', (data) => output += data.toString());
            proc.stderr.on('data', (data) => output += data.toString());
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        message: 'mkcert依存関係のインストールが完了しました',
                        output
                    });
                } else {
                    resolve({
                        success: false,
                        error: `インストール失敗 (code: ${code})`,
                        output
                    });
                }
            });
        });
    }

    /**
     * リソースクリーンアップ
     */
    destroy() {
        this.manager.destroy();
        this.removeAllListeners();
    }

    /**
     * Express.jsミドルウェア
     */
    middleware() {
        return this.manager.expressMiddleware();
    }

    /**
     * HTTPS設定オブジェクトを取得
     */
    async getHttpsOptions() {
        const fs = require('fs-extra');
        
        // 証明書が存在しない場合は生成
        if (!await fs.pathExists(this.manager.certFile)) {
            await this.generate();
        }
        
        return {
            key: await fs.readFile(this.manager.keyFile),
            cert: await fs.readFile(this.manager.certFile)
        };
    }

    /**
     * Express.js HTTPS サーバー統合
     */
    async createHttpsServer(app, options = {}) {
        const https = require('https');
        const httpsOptions = await this.getHttpsOptions();
        
        const server = https.createServer(httpsOptions, app);
        
        // 証明書変更時の自動再起動（オプション）
        if (options.autoRestart !== false) {
            this.startWatching(() => {
                console.log('🔄 証明書が更新されました。サーバーを再起動してください。');
                // 注意: 実際の再起動は手動またはプロセス管理ツールで行う
                this.emit('restart-required');
            });
        }
        
        return server;
    }

    /**
     * Webpack Dev Server統合
     */
    async getWebpackDevServerConfig(existingConfig = {}) {
        const httpsOptions = await this.getHttpsOptions();
        
        return {
            ...existingConfig,
            https: {
                ...httpsOptions,
                ...(existingConfig.https || {})
            },
            allowedHosts: [
                'localhost',
                '127.0.0.1',
                '192.168.40.99',
                ...(existingConfig.allowedHosts || [])
            ]
        };
    }

    /**
     * リソースクリーンアップ
     */
    destroy() {
        console.log('🧹 MkcertAutoRenewer: リソースクリーンアップを開始...');
        
        // ファイル監視を停止
        this.stopWatching();
        
        // 自動更新スケジュールを停止
        this.stopAutoRenewal();
        
        // マネージャーを破棄
        this.manager.destroy();
        
        // イベントリスナーを削除
        this.removeAllListeners();
        
        console.log('✅ MkcertAutoRenewer: リソースクリーンアップが完了しました');
    }
}

module.exports = MkcertAutoRenewer;