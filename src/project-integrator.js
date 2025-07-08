const fs = require('fs-extra');
const path = require('path');

/**
 * プロジェクト統合ユーティリティ
 * Express.js、Webpack、Next.js等への統合ヘルパー
 */
class ProjectIntegrator {
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Express.js HTTPSサーバー設定の生成
     */
    async getExpressHttpsOptions() {
        const config = this.manager.config;
        
        // 証明書が存在しない場合は生成
        if (!await fs.pathExists(config.certFile) || !await fs.pathExists(config.keyFile)) {
            console.log('🔐 証明書が見つかりません。新規生成します...');
            const result = await this.manager.generateCertificate(config.domains);
            if (!result.success) {
                throw new Error(`証明書生成失敗: ${result.error}`);
            }
        }

        try {
            const httpsOptions = {
                key: await fs.readFile(config.keyFile),
                cert: await fs.readFile(config.certFile)
            };

            return {
                success: true,
                httpsOptions,
                certFile: config.certFile,
                keyFile: config.keyFile
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Webpack Dev Server設定の生成
     */
    async getWebpackDevServerConfig() {
        const httpsResult = await this.getExpressHttpsOptions();
        
        if (!httpsResult.success) {
            throw new Error(`Webpack設定生成失敗: ${httpsResult.error}`);
        }

        return {
            server: {
                type: 'https',
                options: httpsResult.httpsOptions
            },
            port: this.manager.config.httpsPort,
            host: '0.0.0.0',
            allowedHosts: 'all'
        };
    }

    /**
     * Next.js設定の生成
     */
    async getNextJsConfig() {
        const httpsResult = await this.getExpressHttpsOptions();
        
        if (!httpsResult.success) {
            throw new Error(`Next.js設定生成失敗: ${httpsResult.error}`);
        }

        return {
            server: {
                https: httpsResult.httpsOptions,
                port: this.manager.config.httpsPort
            }
        };
    }

    /**
     * 証明書変更時のホットリロード設定
     */
    setupHotReload(reloadCallback) {
        return this.manager.startMonitoring((event, filePath) => {
            if (event === 'change' && (filePath.endsWith('.pem') || filePath.endsWith('.key'))) {
                console.log('🔄 証明書変更を検知しました。サーバーを再起動します...');
                if (typeof reloadCallback === 'function') {
                    reloadCallback();
                }
            }
        });
    }

    /**
     * 統合設定ファイルの生成
     */
    async generateIntegrationConfig(projectType = 'express') {
        const config = this.manager.config;
        const integrationConfig = {
            projectType,
            timestamp: new Date().toISOString(),
            https: {
                enabled: true,
                port: config.httpsPort,
                certFile: config.certFile,
                keyFile: config.keyFile
            },
            http: {
                enabled: true,
                port: config.httpPort,
                redirectToHttps: true
            },
            domains: config.domains,
            autoRenewal: {
                enabled: config.autoRenewal,
                schedule: config.cronPattern,
                warningDays: config.warningDays
            }
        };

        const configPath = path.join(config.certPath, 'integration-config.json');
        await fs.ensureDir(path.dirname(configPath));
        await fs.writeJSON(configPath, integrationConfig, { spaces: 2 });

        return {
            success: true,
            configPath,
            config: integrationConfig
        };
    }
}

module.exports = ProjectIntegrator;
