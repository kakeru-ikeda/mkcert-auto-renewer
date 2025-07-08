const CertificateManager = require('./certificate-manager');

/**
 * mkcert証明書自動更新システム - メインAPI
 * Express.js、Webpack Dev Server、その他のNode.jsプロジェクトで使用
 */
class MkcertAutoRenewer {
    constructor(options = {}) {
        this.manager = new CertificateManager(options);
        
        // イベントのプロキシ
        this.manager.on('generated', (...args) => this.emit('generated', ...args));
        this.manager.on('error', (...args) => this.emit('error', ...args));
        this.manager.on('certificate-changed', (...args) => this.emit('certificate-changed', ...args));
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
     * 自動更新スケジュール設定
     */
    scheduleAutoRenewal(cronPattern = '0 2 * * 0', domains) {
        return this.manager.scheduleAutoRenewal(cronPattern, domains);
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
        this.manager.destroy();
    }
}

// EventEmitter継承
const EventEmitter = require('events');
Object.setPrototypeOf(MkcertAutoRenewer.prototype, EventEmitter.prototype);

module.exports = MkcertAutoRenewer;