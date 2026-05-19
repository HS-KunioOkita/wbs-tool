# WBS / ガントチャート管理ツール

ローカル PC 上で動作する単独利用者向け WBS / ガントチャート Web アプリ。

詳細な設計は [docs/design/basic-design.md](docs/design/basic-design.md)、実装工程は [docs/implementation-plan.md](docs/implementation-plan.md) を参照。

## 構成

monorepo（npm workspaces）

- `apps/server` — Node.js + Fastify + better-sqlite3（REST API + 静的配信）
- `apps/web` — React + Vite（SPA, ガント描画は SVG 自前実装）
- `packages/shared` — クライアント／サーバで共有する DTO・エラーコード・バリデーション

## 必要環境

- Node.js 20.10 以上
- npm 10 以上
- macOS（最新および 1 つ前のメジャー）/ Chrome 最新版（推奨）

## セットアップ

```bash
npm install
```

## 開発

```bash
# API サーバ（ポート 5174）
npm run dev

# フロントエンド（ポート 5173、API はプロキシ）
npm run dev:web
```

## テスト・品質ゲート

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

## ビルド・本番起動

```bash
npm run build
npm start
```

## DB ファイル

既定の SQLite ファイルパス: `./data/wbs.sqlite`

起動時に自動マイグレーションが走り、`PRAGMA integrity_check` で破損検知を行います。

```bash
# 整合性チェック単体実行
npm run db:check
```

バックアップは OS 機能でファイルをコピーしてください（アプリ側で自動化は行いません）。

## 実装ステータス

現在 **フェーズ 1（環境構築・基盤・データ層・ドメイン層）** が完了。

- 完了: T-001〜T-030 + 対応する単体テスト
- 未着手: API 層（T-031〜041）、フロントエンド（T-042〜063）、E2E（T-073〜081）
