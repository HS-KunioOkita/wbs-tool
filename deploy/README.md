# wbs-tool デプロイ（macOS 常駐）

wbs-tool を **1プロセス**（Fastify が API とビルド済み SPA の両方を配信）で起動し、
macOS の `launchd` で常駐させる手順。個人・単一ノード・SQLite 運用を前提とする。

## 構成

- 本番では Vite dev は使わない。`apps/web` を静的ビルドし、`apps/server` の Fastify が
  `@fastify/static` で `apps/web/dist` を配信する（`SERVE_STATIC=true` のときのみ有効）。
- SPA のクライアントルーティングは、`/api` 以外の GET を `index.html` にフォールバックして対応。
  SPA は API を相対パス `/api` で叩くため、同一オリジン配信で CORS もプロキシも不要。
- 管理対象プロセスは Fastify サーバ 1 つだけ。
- サーバは **`tsx` ローダ経由で TypeScript を直接実行**する（`node --import tsx src/index.ts`）。
  本プロジェクトは ESM + `moduleResolution: Bundler` で、workspace パッケージ `@wbs-tool/shared`
  の `main`/`exports` が `.ts`（`src/index.ts`）を指すため、素の `node dist/index.js` では
  解決できない。dev と同じく tsx で動かす。`tsx` は本番依存（`apps/server` の dependencies）に含めてある。
- **可変データ（SQLite）はリポジトリ外に保存する**。既定は `~/.wbs-tool/wbs.sqlite`
  （`WBS_TOOL_DATA_DIR` で変更可）。runtime は plist の `DB_PATH`（絶対パス）で参照する。
  DB スキーマの**マイグレーションはサーバ起動時に自動適用**されるため、別途コマンドは不要。

## 1. ビルド

リポジトリルートで:

```bash
npm ci                 # 依存導入（初回 / 更新時。tsx を含む）
npm run prod:prepare   # = npm run build:web（apps/web を vite build で dist/ に出力）
```

手動で起動確認する場合（DB は既定の開発用パス apps/server/data/wbs.sqlite になる点に注意）:

```bash
npm run start:prod                          # SERVE_STATIC=true で Fastify を起動（既定 5174）
curl -s http://localhost:5174/healthz       # {"status":"ok"}
open http://localhost:5174                  # SPA が表示される
```

## 2. launchd へ常駐登録

```bash
bash deploy/launchd/install.sh
# ポートを変える場合（plist の PORT と表示に反映）:
PORT=8080 bash deploy/launchd/install.sh
# データ保存先を変える場合（既定 ~/.wbs-tool）:
WBS_TOOL_DATA_DIR=/path/to/data bash deploy/launchd/install.sh
```

`install.sh` は:

- 事前チェック（node / tsx / `apps/web/dist/index.html` の存在）。
- データディレクトリ（既定 `~/.wbs-tool`）を作成（DB 本体とスキーマは初回起動時に自動生成・移行される）。
- `node` の絶対パス・リポジトリパス・ログ出力先・ポート・`DB_PATH`・`WEB_DIST_PATH`（すべて絶対パス）を
  テンプレートへ埋め込み、`~/Library/LaunchAgents/com.wbstool.server.plist` を生成する。
- `launchctl load -w` で登録（ログイン時に自動起動・`KeepAlive` でクラッシュ時自動再起動）。
- 冪等。設定変更後に再実行すれば unload→load で反映される。

保存先:

- データ: `~/.wbs-tool/wbs.sqlite`（既定）
- 標準出力ログ: `~/Library/Logs/wbs-tool.out.log`
- 標準エラーログ: `~/Library/Logs/wbs-tool.err.log`

## 3. 運用コマンド

```bash
launchctl list | grep com.wbstool.server                            # 稼働確認
launchctl unload ~/Library/LaunchAgents/com.wbstool.server.plist    # 一時停止
launchctl load -w ~/Library/LaunchAgents/com.wbstool.server.plist   # 再開
bash deploy/launchd/uninstall.sh                                    # 常駐解除（データ削除はインタラクティブに確認）
```

`uninstall.sh` は plist を解除・削除したうえで、**データ（`~/.wbs-tool` 等）を削除するか
を対話確認**する（既定は保持）。非対話で削除したい場合は `PURGE_DATA=true` を付ける:

```bash
PURGE_DATA=true bash deploy/launchd/uninstall.sh
```

更新デプロイ時は「`git pull` → `npm ci`（必要時）→ `npm run prod:prepare` →
`bash deploy/launchd/install.sh`（unload→load で再起動。既存データはそのまま）」の順。

## 補足

- 本番のデータ（SQLite）は `~/.wbs-tool`（または `WBS_TOOL_DATA_DIR`）に絶対パスで保存され、
  plist の `DB_PATH` で参照される。開発時の `apps/server/data/wbs.sqlite` とは独立。
- サーバは `127.0.0.1` に限定して待ち受ける（ローカル常駐前提）。
- ポート占有時は `FALLBACK_PORT`（既定 5184）へ自動フォールバックする。
- クラスタリングは行わない（SQLite 単一ファイルのためマルチプロセスは非推奨）。
- バックアップは `~/.wbs-tool/wbs.sqlite` をコピーするだけでよい。
