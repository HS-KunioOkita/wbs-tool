# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

ローカル PC 上で動作する単独利用者向け WBS / ガントチャート管理 Web アプリ。npm workspaces による monorepo。認証なし・localhost 限定・SQLite ファイル 1 個にデータを格納する。ドキュメント・コードコメントは日本語。

## コマンド

```bash
npm install                 # セットアップ（Node.js >= 20.10）

npm run dev                 # API サーバ（ポート 5174、占有時は 5184 にフォールバック）
npm run dev:web             # フロントエンド（ポート 5173、/api を 5174 にプロキシ）

npm run format:check        # Prettier チェック
npm run lint                # ESLint（--max-warnings 0）
npm run typecheck           # TypeScript strict（全ワークスペース）
npm test                    # 単体テスト（Vitest、全ワークスペース）
npx playwright test         # E2E テスト
```

単体テストの個別実行（Vitest はワークスペースごと）:

```bash
npm run test --workspace apps/server -- tests/domain/task.test.ts
npm run test --workspace apps/web -- tests/gantt/drag.test.ts
```

E2E の個別実行:

```bash
npx playwright test e2e/e2e-02-task-crud.spec.ts
```

E2E は専用ポート（API 5274 / web 5273）と OS 一時ディレクトリの使い捨て DB を使うため、`npm run dev` 稼働中に流しても開発用 DB（`./data/wbs.sqlite`）には触れない。

CI（`.github/workflows/ci.yml`）は format:check → lint → typecheck → test → build の順で実行。pre-commit で lint-staged（Prettier + ESLint）が走る。

## アーキテクチャ

### ワークスペース構成と共有契約

- `apps/server` — Fastify + better-sqlite3。REST API + 本番時は静的配信も担う単一プロセス
- `apps/web` — React + Vite SPA。ガントチャートは SVG 自前描画、PDF エクスポートもクライアント側（jsPDF + svg2pdf.js）
- `packages/shared` — クライアント／サーバ双方が参照する契約: エラーコード（`ERR-NNN`）、バリデーションルール定数（`VR`）、API DTO 型、Zod スキーマ。web は vite.config.ts の alias で shared のソースを直接参照する

### サーバ 3 レイヤ + 集約ルート

`http/routes`（Zod でリクエスト検証・DTO 変換）→ `domain`（業務ルール）→ `db`（Repository + DAO）。

中心は `apps/server/src/domain/project-wbs.ts` の **ProjectWbs 集約ルート（CLS-004）**。タスク・依存関係の追加／更新／削除はすべてこの集約を経由し、業務ルール（親子循環、依存循環、進捗の親集約など）を守る。重要な設計判断:

- 親タスクの派生値（start_date / due_date / progress）は**書き込み時に再算出して永続化**する。読み取り時に計算しない
- 親 progress は子の期間日数による重み付き平均（整数四捨五入）
- `ProjectWbsRepository` は「ロード時に全タスク・全依存をメモリ展開、セーブ時はトランザクション内で全置換」する素朴な実装（最大 500 タスク / 1,000 依存の規模前提）

### エラーモデル

`apps/server/src/errors/app-errors.ts` の AppError サブクラスが shared の `ERROR_CODE`（ERR-001〜006）にマップされ、`http/middleware/error-handler.ts` が統一形式の JSON エラー応答に変換する。クライアントは同じエラーコードを参照して処理する。各リクエストに `X-Correlation-Id` を発行し、構造化 JSON ログとエラー応答に同一 ID を埋め込む。

### フロントエンドの状態管理

`apps/web/src/store/project-store.ts`（Zustand）はサーバを正本とするミラー。**楽観的更新は採らない**（アーキ設計 RISK-005）— API 応答を受けてから `reloadTasks` / `reloadDependencies` で再ロードする。ガント描画ロジックは `features/wbs/gantt/`（座標計算 `coordinates.ts`、ドラッグ `drag.ts` は純粋関数として分離されテスト対象）。

## 設計書とのトレーサビリティ

このリポジトリは設計書駆動で実装されている。コードコメントの `CLS-NNN` / `VR-NNN` / `RULE-NNN` / `ERR-NNN` / `UI-NNN` / `API-NNN` / `NFR-NNN` / `UC-NNN` は `docs/` 配下の設計書の ID を指す:

- `docs/design/basic-design.md` — 収束版基本設計（全体像はまずここ）
- `docs/design/{architecture,class,data,interface,screen,uiux}/` — 個別設計書
- `docs/requirements/` — 機能・非機能要件
- `docs/implementation-plan.md` — 実装工程計画（タスク T-NNN、リリース判定基準）

業務ルールやバリデーションを変更する際は、対応する設計 ID を設計書で確認し、コメントの ID 参照を維持すること。設計に無い仕様を勝手に足さない。
