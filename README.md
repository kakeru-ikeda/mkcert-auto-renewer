# mkcert-auto-renewer

� クロスプラットフォーム対応のmkcert証明書自動更新システム

Windows、macOS、Linuxで動作し、Express.js、Webpack Dev Server、Next.js等のNode.jsプロジェクトに簡単に統合できます。

## 特徴

- 🌍 **クロスプラットフォーム対応**: Windows、macOS、Linux
- 🔄 **自動更新**: 証明書の期限切れ前に自動更新
- 📁 **ファイル監視**: 証明書ファイルの変更を監視
- 🔧 **簡単統合**: Express.js、Webpack、Next.js等への統合
- 📋 **CLIツール**: コマンドラインからの操作
- 🎯 **gitサブモジュール対応**: プロジェクトに組み込み可能

## インストール

### npmパッケージとして

```bash
npm install mkcert-auto-renewer
```

### gitサブモジュールとして

```bash
git submodule add https://github.com/kakeru-ikeda/mkcert-auto-renewer.git mkcert-auto-renewer
cd mkcert-auto-renewer
npm install
```

## 基本的な使用方法

### JavaScript/Node.js

```javascript
const MkcertAutoRenewer = require('mkcert-auto-renewer');

// 基本的な使用
const renewer = new MkcertAutoRenewer({
    certPath: './certs',
    certName: 'localhost+3',
    domains: ['localhost', '127.0.0.1', '::1']
});

// 証明書生成
await renewer.generate(['localhost', '127.0.0.1', '::1']);

// 有効期限チェック
const expiry = await renewer.checkExpiry();
console.log('証明書有効期限:', expiry);

// 自動更新設定
renewer.scheduleAutoRenewal('0 2 * * 0', ['localhost', '127.0.0.1', '::1']);

// ファイル監視
renewer.startWatching((filePath) => {
    console.log('証明書が変更されました:', filePath);
});
```

### Express.js統合

```javascript
const express = require('express');
const https = require('https');
const MkcertAutoRenewer = require('mkcert-auto-renewer');

const app = express();
const renewer = new MkcertAutoRenewer({
    certPath: './certs',
    httpsPort: 3443
});

// HTTPS設定を取得
const httpsOptions = await renewer.getExpressHttpsOptions();

if (httpsOptions.success) {
    const server = https.createServer(httpsOptions.httpsOptions, app);
    
    // 証明書変更時のサーバー再起動
    renewer.setupHotReload(() => {
        server.close(() => {
            console.log('🔄 HTTPSサーバーを再起動しています...');
            // サーバー再起動処理
        });
    });
    
    server.listen(3443, () => {
        console.log('🚀 HTTPSサーバーがポート3443で起動しました');
    });
} else {
    console.error('HTTPS設定取得エラー:', httpsOptions.error);
}
```

### Webpack Dev Server統合

```javascript
const MkcertAutoRenewer = require('mkcert-auto-renewer');

const renewer = new MkcertAutoRenewer();
const webpackConfig = await renewer.getWebpackDevServerConfig();

module.exports = {
    // ... その他の設定
    devServer: {
        ...webpackConfig,
        // その他のdev server設定
    }
};
```

## CLIツール

### 証明書生成

```bash
# 基本的な生成
npx mkcert-renewer generate

# カスタムドメインで生成
npx mkcert-renewer generate -d localhost,127.0.0.1,example.dev

# カスタムパスで生成
npx mkcert-renewer generate -p /path/to/certs -n mycert
```

### 証明書チェック

```bash
# 有効期限チェック
npx mkcert-renewer check

# カスタムパスでチェック
npx mkcert-renewer check -p /path/to/certs -n mycert
```

### 証明書監視

```bash
# 証明書ファイルの変更を監視
npx mkcert-renewer monitor

# カスタムパスで監視
npx mkcert-renewer monitor -p /path/to/certs -n mycert
```

### 自動更新スケジュール

```bash
# 毎週日曜日2時に自動更新
npx mkcert-renewer schedule

# カスタムcronパターンで自動更新
npx mkcert-renewer schedule -c "0 2 * * 0" -d localhost,127.0.0.1
```

### 依存関係インストール

```bash
# mkcertのインストール
npx mkcert-renewer install
```

## 設定オプション

### 環境変数

```bash
# 基本設定
HTTPS_CERT_PATH=/path/to/certs
HTTPS_CERT_NAME=localhost+3
HTTPS_KEY_PATH=/path/to/certs
HTTPS_PORT=3443
HTTP_PORT=3001

# 自動更新設定
AUTO_RENEWAL=true
CERT_WARNING_DAYS=10
CERT_CRON_PATTERN="0 2 * * 0"
HTTPS_DOMAINS=localhost,127.0.0.1,::1
```

### プログラム設定

```javascript
const renewer = new MkcertAutoRenewer({
    certPath: './certs',              // 証明書ディレクトリ
    certName: 'localhost+3',          // 証明書名
    httpsPort: 3443,                  // HTTPSポート
    httpPort: 3001,                   // HTTPポート
    autoRenewal: true,                // 自動更新有効
    warningDays: 10,                  // 更新警告日数
    cronPattern: '0 2 * * 0',         // 更新スケジュール
    domains: ['localhost', '127.0.0.1', '::1']  // 対象ドメイン
});
```

## イベント

```javascript
renewer.on('generated', (data) => {
    console.log('証明書生成完了:', data);
});

renewer.on('certificate-changed', (data) => {
    console.log('証明書変更検知:', data);
});

renewer.on('auto-renewal-triggered', () => {
    console.log('自動更新開始');
});

renewer.on('auto-renewal-completed', () => {
    console.log('自動更新完了');
});

renewer.on('error', (error) => {
    console.error('エラー:', error);
});
```

## API リファレンス

### MkcertAutoRenewer

#### コンストラクタ

```javascript
new MkcertAutoRenewer(options)
```

#### メソッド

- `generate(domains)` - 証明書生成
- `checkExpiry()` - 有効期限チェック
- `needsRenewal(warningDays)` - 更新必要性チェック
- `startWatching(callback)` - ファイル監視開始
- `stopWatching()` - ファイル監視停止
- `scheduleAutoRenewal(cronPattern, domains)` - 自動更新スケジュール
- `getExpressHttpsOptions()` - Express.js用HTTPS設定取得
- `getWebpackDevServerConfig()` - Webpack Dev Server設定取得
- `getNextJsConfig()` - Next.js設定取得
- `setupHotReload(callback)` - ホットリロード設定
- `installDependencies()` - mkcert依存関係インストール
- `destroy()` - リソースクリーンアップ

## プラットフォーム対応

### Windows

- PowerShellスクリプト対応
- Chocolatey経由でのmkcertインストール
- タスクスケジューラー連携

### macOS

- Homebrew経由でのmkcertインストール
- launchd対応

### Linux

- systemd対応
- cron連携
- 手動インストール手順提供

## 統合例

### Express.js + WebSocket

```javascript
const express = require('express');
const https = require('https');
const WebSocket = require('ws');
const MkcertAutoRenewer = require('mkcert-auto-renewer');

const app = express();
const renewer = new MkcertAutoRenewer();

// HTTPS設定
const httpsOptions = await renewer.getExpressHttpsOptions();
const server = https.createServer(httpsOptions.httpsOptions, app);

// WebSocketサーバー
const wss = new WebSocket.Server({ server });

// 証明書変更時の処理
renewer.setupHotReload(() => {
    // WebSocketクライアントに通知
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'certificate-updated' }));
    });
});

server.listen(3443);
```

### Next.js

```javascript
// next.config.js
const MkcertAutoRenewer = require('mkcert-auto-renewer');

module.exports = async () => {
    const renewer = new MkcertAutoRenewer();
    const nextConfig = await renewer.getNextJsConfig();
    
    return {
        ...nextConfig,
        // その他のNext.js設定
    };
};
```

## トラブルシューティング

### よくある問題

1. **mkcertがインストールされていない**
   ```bash
   npx mkcert-renewer install
   ```

2. **証明書ディレクトリが存在しない**
   ```bash
   mkdir -p certs
   ```

3. **権限エラー**
   ```bash
   sudo chown -R $USER:$USER certs/
   ```

### デバッグ

```javascript
const renewer = new MkcertAutoRenewer({ debug: true });

renewer.on('error', (error) => {
    console.error('デバッグ:', error);
});
```

## ライセンス

MIT License

## 貢献

プルリクエストや問題報告は歓迎します。

## サポート

- GitHub Issues: https://github.com/kakeru-ikeda/mkcert-auto-renewer/issues

## 更新履歴

### v1.0.0
- 初期リリース
- クロスプラットフォーム対応
- Express.js統合
- CLI対応