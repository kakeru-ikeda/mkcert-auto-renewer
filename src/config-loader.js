const path = require('path');
const fs = require('fs-extra');

/**
 * 設定ファイルローダー
 * 環境変数、設定ファイル、デフォルト値を統合
 */
class ConfigLoader {
    static load(options = {}) {
        const defaultConfig = {
            certPath: process.env.HTTPS_CERT_PATH || path.join(process.cwd(), 'certs'),
            certName: process.env.HTTPS_CERT_NAME || 'localhost+3',
            keyPath: process.env.HTTPS_KEY_PATH || path.join(process.cwd(), 'certs'),
            httpsPort: process.env.HTTPS_PORT || 3443,
            httpPort: process.env.HTTP_PORT || 3001,
            autoRenewal: process.env.AUTO_RENEWAL !== 'false',
            warningDays: parseInt(process.env.CERT_WARNING_DAYS) || 10,
            cronPattern: process.env.CERT_CRON_PATTERN || '0 2 * * 0', // 毎週日曜日 2:00 AM
            domains: process.env.HTTPS_DOMAINS ? process.env.HTTPS_DOMAINS.split(',') : ['localhost', '127.0.0.1', '::1']
        };

        // オプションで上書き
        const config = { ...defaultConfig, ...options };

        // パスの正規化
        config.certPath = path.resolve(config.certPath);
        config.keyPath = path.resolve(config.keyPath);

        // 証明書ファイルの完全パス
        config.certFile = path.join(config.certPath, `${config.certName}.pem`);
        config.keyFile = path.join(config.keyPath, `${config.certName}-key.pem`);

        return config;
    }

    /**
     * 設定ファイルからの読み込み
     */
    static async loadFromFile(configPath) {
        try {
            if (await fs.pathExists(configPath)) {
                const fileConfig = await fs.readJSON(configPath);
                return this.load(fileConfig);
            }
        } catch (error) {
            console.warn(`⚠️  設定ファイル読み込みエラー: ${error.message}`);
        }
        return this.load();
    }

    /**
     * 設定の保存
     */
    static async saveToFile(config, configPath) {
        try {
            await fs.ensureDir(path.dirname(configPath));
            await fs.writeJSON(configPath, config, { spaces: 2 });
            return true;
        } catch (error) {
            console.error(`❌ 設定保存エラー: ${error.message}`);
            return false;
        }
    }
}

module.exports = ConfigLoader;
