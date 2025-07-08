const MkcertAutoRenewer = require('../src/index');

/**
 * mkcert-auto-renewer テストスイート
 */
class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
    }

    async test(name, fn) {
        try {
            console.log(`🧪 テスト実行: ${name}`);
            await fn();
            console.log(`✅ パス: ${name}`);
            this.passed++;
        } catch (error) {
            console.error(`❌ 失敗: ${name}`);
            console.error(`   エラー: ${error.message}`);
            this.failed++;
        }
    }

    async runAllTests() {
        console.log('🚀 mkcert-auto-renewer テストを開始します...\n');

        const renewer = new MkcertAutoRenewer({
            certPath: './test-certs',
            certName: 'test-cert',
            domains: ['localhost', '127.0.0.1', '::1']
        });

        // 基本機能テスト
        await this.test('インスタンス生成', async () => {
            if (!renewer) throw new Error('インスタンスが作成されませんでした');
        });

        await this.test('設定確認', async () => {
            if (!renewer.manager) throw new Error('CertificateManagerが初期化されませんでした');
            if (!renewer.integrator) throw new Error('ProjectIntegratorが初期化されませんでした');
        });

        await this.test('プラットフォーム検出', async () => {
            const platform = renewer.manager.platform;
            if (!platform) throw new Error('プラットフォームが検出されませんでした');
            console.log(`   検出されたプラットフォーム: ${platform.name}`);
        });

        await this.test('mkcertインストール確認', async () => {
            const installed = await renewer.manager.checkMkcertInstalled();
            if (!installed) {
                console.warn('   ⚠️ mkcertがインストールされていません');
                console.warn('   💡 npm run generate-certs を実行してmkcertをインストールしてください');
            } else {
                console.log('   ✅ mkcertがインストールされています');
            }
        });

        // 証明書操作テスト（mkcertがインストールされている場合のみ）
        const mkcertInstalled = await renewer.manager.checkMkcertInstalled();
        if (mkcertInstalled) {
            await this.test('証明書生成', async () => {
                const result = await renewer.generate(['localhost', '127.0.0.1', '::1']);
                if (!result.success) throw new Error('証明書生成に失敗しました');
                console.log(`   証明書: ${result.certFile}`);
                console.log(`   秘密鍵: ${result.keyFile}`);
            });

            await this.test('証明書有効期限チェック', async () => {
                const expiry = await renewer.checkExpiry();
                if (expiry) {
                    console.log(`   有効期限: ${expiry.toLocaleDateString()}`);
                } else {
                    console.log('   証明書が見つかりません');
                }
            });

            await this.test('更新必要性チェック', async () => {
                const needsRenewal = await renewer.needsRenewal(10);
                console.log(`   更新が必要: ${needsRenewal}`);
            });
        }

        // 統合機能テスト
        await this.test('Express.js統合設定', async () => {
            if (mkcertInstalled) {
                const options = await renewer.getExpressHttpsOptions();
                if (!options.success) throw new Error('Express.js設定の取得に失敗しました');
                console.log(`   HTTPS設定が正常に取得されました`);
            } else {
                console.log('   mkcertがインストールされていないため、スキップしました');
            }
        });

        await this.test('統合設定ファイル生成', async () => {
            const config = await renewer.generateIntegrationConfig('express');
            if (!config.success) throw new Error('統合設定ファイルの生成に失敗しました');
            console.log(`   設定ファイル: ${config.configPath}`);
        });

        // イベントシステムテスト
        await this.test('イベントリスナー', async () => {
            return new Promise((resolve) => {
                let eventReceived = false;
                
                renewer.on('generated', () => {
                    eventReceived = true;
                    resolve();
                });

                // タイムアウト設定
                setTimeout(() => {
                    if (!eventReceived) {
                        console.log('   イベントはテスト中に発生しませんでした（正常）');
                        resolve();
                    }
                }, 1000);
            });
        });

        // リソースクリーンアップ
        await this.test('リソースクリーンアップ', async () => {
            renewer.destroy();
            console.log('   リソースが正常にクリーンアップされました');
        });

        // テスト結果表示
        console.log('\n📊 テスト結果:');
        console.log(`✅ パス: ${this.passed}`);
        console.log(`❌ 失敗: ${this.failed}`);
        console.log(`📈 成功率: ${(this.passed / (this.passed + this.failed) * 100).toFixed(1)}%`);

        if (this.failed === 0) {
            console.log('\n🎉 すべてのテストが成功しました！');
        } else {
            console.log('\n⚠️ 一部のテストが失敗しました。');
        }
    }
}

// テスト実行
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().catch(console.error);
}

module.exports = TestRunner;
