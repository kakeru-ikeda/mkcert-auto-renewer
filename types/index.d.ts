import { EventEmitter } from 'events';
import { Server } from 'https';
import { Application } from 'express';

declare namespace MkcertAutoRenewer {
  /**
   * MkcertAutoRenewerのコンストラクタオプション
   */
  interface Options {
    /** 証明書ディレクトリのパス */
    certPath?: string;
    /** 証明書ファイル名（拡張子なし） */
    certName?: string;
    /** HTTPSポート */
    httpsPort?: number;
    /** HTTPポート */
    httpPort?: number;
    /** 自動更新を有効にするかどうか */
    autoRenewal?: boolean;
    /** 証明書の有効期限が切れる前に警告を表示する日数 */
    warningDays?: number;
    /** 自動更新のcronパターン */
    cronPattern?: string;
    /** 対象ドメイン */
    domains?: string[];
    /** デバッグモード */
    debug?: boolean;
  }

  /**
   * 証明書生成結果
   */
  interface GenerateResult {
    success: boolean;
    message?: string;
    error?: string;
    certFile?: string;
    keyFile?: string;
  }

  /**
   * 証明書有効期限情報
   */
  interface ExpiryInfo {
    valid: boolean;
    expiryDate?: Date;
    daysRemaining?: number;
    error?: string;
  }

  /**
   * HTTPS設定オプション
   */
  interface HttpsOptions {
    key: Buffer;
    cert: Buffer;
  }

  /**
   * Express.js HTTPS設定結果
   */
  interface ExpressHttpsResult {
    success: boolean;
    httpsOptions?: HttpsOptions;
    certFile?: string;
    keyFile?: string;
    error?: string;
  }

  /**
   * 依存関係インストール結果
   */
  interface InstallResult {
    success: boolean;
    message?: string;
    error?: string;
    instructions?: string[];
    output?: string;
  }

  /**
   * Webpack Dev Server設定
   */
  interface WebpackDevServerConfig {
    https: HttpsOptions & Record<string, any>;
    allowedHosts: string[];
    [key: string]: any;
  }

  /**
   * Next.js設定
   */
  interface NextJsConfig {
    server: {
      https: HttpsOptions;
    };
    [key: string]: any;
  }
}

/**
 * クロスプラットフォーム対応のmkcert証明書自動更新システム
 * Windows、macOS、Linuxで動作し、Express.js、Webpack Dev Server、Next.js等のNode.jsプロジェクトに簡単に統合できます。
 */
declare class MkcertAutoRenewer extends EventEmitter {
  /**
   * MkcertAutoRenewerのコンストラクタ
   * @param options 設定オプション
   */
  constructor(options?: MkcertAutoRenewer.Options);

  /**
   * 証明書の即座生成・更新
   * @param domains 対象ドメイン（デフォルト: ['localhost', '127.0.0.1', '::1']）
   */
  generate(domains?: string[]): Promise<MkcertAutoRenewer.GenerateResult>;

  /**
   * 証明書の有効期限チェック
   */
  checkExpiry(): Promise<MkcertAutoRenewer.ExpiryInfo>;

  /**
   * 更新が必要かチェック
   * @param warningDays 警告を表示する日数（デフォルト: 10）
   */
  needsRenewal(warningDays?: number): Promise<boolean>;

  /**
   * ファイル監視開始
   * @param callback 変更検知時のコールバック
   */
  startWatching(callback?: (filePath: string) => void): void;

  /**
   * 監視停止
   */
  stopWatching(): void;

  /**
   * 自動更新スケジュール設定
   * @param cronPattern cronパターン（デフォルト: '0 2 * * 0'）
   * @param domains 対象ドメイン
   */
  scheduleAutoRenewal(cronPattern?: string, domains?: string[]): void;

  /**
   * 自動更新スケジュール停止
   */
  stopAutoRenewal(): void;

  /**
   * Express.js用HTTPS設定取得
   */
  getExpressHttpsOptions(): Promise<MkcertAutoRenewer.ExpressHttpsResult>;

  /**
   * Webpack Dev Server設定取得
   * @param existingConfig 既存のWebpack設定（オプション）
   */
  getWebpackDevServerConfig(existingConfig?: Record<string, any>): Promise<MkcertAutoRenewer.WebpackDevServerConfig>;

  /**
   * Next.js設定取得
   */
  getNextJsConfig(): Promise<MkcertAutoRenewer.NextJsConfig>;

  /**
   * 証明書変更時のホットリロード設定
   * @param reloadCallback リロード時のコールバック
   */
  setupHotReload(reloadCallback: () => void): void;

  /**
   * 統合設定ファイルの生成
   * @param projectType プロジェクトタイプ（'express', 'webpack', 'nextjs'等）
   */
  generateIntegrationConfig(projectType?: string): Promise<any>;

  /**
   * Express.js統合用のミドルウェア
   */
  expressMiddleware(): Function;

  /**
   * Express.js用ミドルウェア（expressMiddlewareの別名）
   */
  middleware(): Function;

  /**
   * mkcert依存関係のインストール
   */
  installDependencies(): Promise<MkcertAutoRenewer.InstallResult>;

  /**
   * HTTPS設定オブジェクトを取得
   */
  getHttpsOptions(): Promise<MkcertAutoRenewer.HttpsOptions>;

  /**
   * Express.js HTTPS サーバー統合
   * @param app Express.jsアプリケーション
   * @param options サーバーオプション
   */
  createHttpsServer(app: Application, options?: { autoRestart?: boolean }): Promise<Server>;

  /**
   * リソースクリーンアップ
   */
  destroy(): void;
}

export = MkcertAutoRenewer;
