#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const MkcertAutoRenewer = require('./index');

const program = new Command();

program
    .name('mkcert-renewer')
    .description('Cross-platform mkcert certificate auto-renewal CLI')
    .version('1.0.0');

program
    .command('generate')
    .description('Generate new certificates')
    .option('-d, --domains <domains>', 'Comma-separated list of domains', 'localhost,127.0.0.1,::1')
    .option('-p, --path <path>', 'Certificate output path', process.cwd())
    .option('-n, --name <name>', 'Certificate name', 'localhost+3')
    .action(async (options) => {
        console.log(chalk.blue('🔐 証明書を生成しています...'));
        
        const renewer = new MkcertAutoRenewer({
            certPath: options.path,
            certName: options.name,
            domains: options.domains.split(',')
        });

        try {
            const result = await renewer.generate(options.domains.split(','));
            if (result.success) {
                console.log(chalk.green('✅ 証明書生成完了'));
                console.log(`📁 証明書: ${result.certFile}`);
                console.log(`🔑 秘密鍵: ${result.keyFile}`);
            } else {
                console.log(chalk.red('❌ 証明書生成失敗'));
                console.log(result.error);
            }
        } catch (error) {
            console.error(chalk.red('💥 エラー:'), error.message);
        }
    });

program
    .command('check')
    .description('Check certificate expiry')
    .option('-p, --path <path>', 'Certificate path', process.cwd())
    .option('-n, --name <name>', 'Certificate name', 'localhost+3')
    .action(async (options) => {
        console.log(chalk.blue('🔍 証明書の有効期限をチェックしています...'));
        
        const renewer = new MkcertAutoRenewer({
            certPath: options.path,
            certName: options.name
        });

        try {
            const expiry = await renewer.checkExpiry();
            if (expiry) {
                const daysUntilExpiry = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
                console.log(chalk.green(`📅 有効期限: ${expiry.toLocaleDateString()}`));
                console.log(chalk.yellow(`⏰ 残り日数: ${daysUntilExpiry}日`));
                
                if (daysUntilExpiry <= 10) {
                    console.log(chalk.red('⚠️  証明書の更新が必要です'));
                } else {
                    console.log(chalk.green('✅ 証明書は有効です'));
                }
            } else {
                console.log(chalk.red('❌ 証明書が見つかりません'));
            }
        } catch (error) {
            console.error(chalk.red('💥 エラー:'), error.message);
        }
    });

program
    .command('monitor')
    .description('Start monitoring certificate files')
    .option('-p, --path <path>', 'Certificate path', process.cwd())
    .option('-n, --name <name>', 'Certificate name', 'localhost+3')
    .action(async (options) => {
        console.log(chalk.blue('👁️  証明書ファイルの監視を開始しています...'));
        
        const renewer = new MkcertAutoRenewer({
            certPath: options.path,
            certName: options.name
        });

        renewer.startWatching((event, filePath) => {
            console.log(chalk.yellow(`📝 ファイル変更検知: ${event} - ${filePath}`));
        });

        console.log(chalk.green('✅ 監視開始完了（Ctrl+Cで停止）'));
        
        // プロセス終了時の処理
        process.on('SIGINT', () => {
            console.log(chalk.blue('\n🛑 監視を停止しています...'));
            process.exit(0);
        });
    });

program
    .command('schedule')
    .description('Schedule automatic renewal')
    .option('-c, --cron <pattern>', 'Cron pattern', '0 2 * * 0')
    .option('-d, --domains <domains>', 'Comma-separated list of domains', 'localhost,127.0.0.1,::1')
    .option('-p, --path <path>', 'Certificate path', process.cwd())
    .option('-n, --name <name>', 'Certificate name', 'localhost+3')
    .action(async (options) => {
        console.log(chalk.blue('⏰ 自動更新スケジュールを設定しています...'));
        
        const renewer = new MkcertAutoRenewer({
            certPath: options.path,
            certName: options.name
        });

        try {
            const result = await renewer.scheduleAutoRenewal(options.cron, options.domains.split(','));
            if (result.success) {
                console.log(chalk.green('✅ 自動更新スケジュール設定完了'));
                console.log(`📅 パターン: ${options.cron}`);
                console.log(`🌐 ドメイン: ${options.domains}`);
                console.log(chalk.yellow('📋 スケジュールを停止するにはCtrl+Cを押してください'));
                
                // プロセス終了時の処理
                process.on('SIGINT', () => {
                    console.log(chalk.blue('\n🛑 自動更新スケジュールを停止しています...'));
                    process.exit(0);
                });
            } else {
                console.log(chalk.red('❌ スケジュール設定失敗'));
                console.log(result.error);
            }
        } catch (error) {
            console.error(chalk.red('💥 エラー:'), error.message);
        }
    });

program
    .command('install')
    .description('Install mkcert dependencies')
    .action(async () => {
        console.log(chalk.blue('📦 mkcert依存関係をインストールしています...'));
        
        const renewer = new MkcertAutoRenewer();
        
        try {
            const result = await renewer.installDependencies();
            if (result.success) {
                console.log(chalk.green('✅ 依存関係インストール完了'));
                console.log(result.message);
            } else {
                console.log(chalk.red('❌ インストール失敗'));
                console.log(result.error);
            }
        } catch (error) {
            console.error(chalk.red('💥 エラー:'), error.message);
        }
    });

if (require.main === module) {
    program.parse();
}

module.exports = program;
