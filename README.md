# WBS / ガントチャート管理ツール

ローカル PC 上で動作する単独利用者向け WBS / ガントチャート Web アプリ。

詳細な設計は [docs/design/basic-design.md](docs/design/basic-design.md)、実装工程は [docs/implementation-plan.md](docs/implementation-plan.md) を参照。

## 構成

monorepo（npm workspaces）

- `apps/server` — Node.js + Fastify + better-sqlite3（REST API + 静的配信）
- `apps/web` — React + Vite（SPA, ガント描画は SVG 自前実装）
- `packages/shared` — クライアント／サーバで共有する DTO・エラーコード・バリデーション

## 必要環境

- Node.js 20.19 以上（22 系は 22.12 以上）
- npm 10 以上
- macOS（最新および 1 つ前のメジャー）/ Chrome 最新版（推奨）

## セットアップ

```bash
npm install
```

## 開発

```bash
# API サーバ（既定ポート 5174。占有時は FALLBACK_PORT=5184 へフォールバック）
npm run dev

# フロントエンド（既定ポート 5173、`/api` を 5174 にプロキシ）
npm run dev:web
```

## テスト・品質ゲート

```bash
npm run format:check    # Prettier
npm run lint            # ESLint
npm run typecheck       # TypeScript strict
npm test                # 単体テスト（Vitest）
npx playwright test     # E2E テスト（Playwright）
```

## ビルド・本番起動

```bash
# ビルド
npm run build

# 本番起動（同一プロセスで API + 静的配信。既定 http://127.0.0.1:5174 ）
npm start
```

停止は `Ctrl+C`（SIGINT）または `kill -TERM <pid>`（SIGTERM）。
両シグナルで graceful shutdown を行い、HTTP サーバを閉じてから SQLite 接続を閉じます。

## 環境変数

| 変数            | 既定値              | 説明                                                                   |
| --------------- | ------------------- | ---------------------------------------------------------------------- |
| `PORT`          | `5174`              | API + 静的配信の待ち受けポート                                         |
| `FALLBACK_PORT` | `5184`              | `PORT` が占有された時の代替ポート（`EADDRINUSE` 検知でフォールバック） |
| `HOST`          | `127.0.0.1`         | バインドアドレス（既定はループバックのみ）                             |
| `DB_PATH`       | `./data/wbs.sqlite` | SQLite ファイルパス                                                    |
| `LOG_PATH`      | （未設定）          | ログファイルパス。未設定なら標準出力のみ                               |
| `LOG_LEVEL`     | `INFO`              | `INFO` / `WARN` / `ERROR`                                              |

## DB ファイル

既定の SQLite ファイルパス: `./data/wbs.sqlite`

起動時に自動マイグレーションが走り、`PRAGMA integrity_check` で破損検知を行います。
破損が検知されると起動を中止して `PersistenceFailureError` を出力します。

```bash
# 整合性チェック単体実行（DB_PATH を解釈）
npm run db:check
```

### バックアップ・リストア

アプリ側で自動バックアップは行いません。サーバを停止した状態で、OS 機能でファイルをコピーしてください。

```bash
# バックアップ（停止後）
cp ./data/wbs.sqlite ./data/wbs.sqlite.bak

# リストア（停止後）
cp ./data/wbs.sqlite.bak ./data/wbs.sqlite
```

稼働中のコピーは整合性を保てないため、必ずサーバを停止してから実施します。

## ログ

構造化 JSON ログ（1 行 1 イベント）。書式:

```json
{
  "ts": "2026-05-19T12:34:56.789Z",
  "level": "INFO",
  "message": "listening on http://127.0.0.1:5174",
  "correlationId": "…"
}
```

- `LOG_PATH` 未設定: 標準出力のみに出力
- `LOG_PATH` 設定時: 標準出力 + 指定ファイルに追記
- レベル: `LOG_LEVEL` で下限を制御（`INFO` 既定）
- 相関 ID: HTTP 各リクエストに `X-Correlation-Id` を発行し、ログとエラー応答に同一 ID を埋め込む

### ログ確認手順（T-066）

```bash
# 1) ログをファイルに出して起動
LOG_PATH=./logs/wbs.log LOG_LEVEL=INFO npm start

# 2) 別ターミナルでリアルタイム表示（標準出力 + ファイル両方に流れる）
tail -f ./logs/wbs.log

# 3) 相関 ID で 1 リクエストの一連のログを抽出
grep '"correlationId":"<id>"' ./logs/wbs.log

# 4) エラーだけ抽出
grep '"level":"ERROR"' ./logs/wbs.log
```

### ログローテーション

アプリ側で自動ローテーションは行いません（NFR-004 単独利用 / 監視基盤連携なし）。
長期運用ではホスト OS の `logrotate`（macOS は `newsyslog`）など外部機構を利用してください。

```
# 例: /etc/logrotate.d/wbs-tool
/path/to/wbs-tool/logs/wbs.log {
    daily
    rotate 7
    missingok
    notifempty
    copytruncate
}
```

`copytruncate` を使う場合、アプリは追記モード（`appendFileSync`）で書き込んでいるため停止不要です。

## 実装ステータス

リリース判定前段階。設計・実装・テストは [docs/implementation-plan.md](docs/implementation-plan.md) §10 の判定基準を参照。
