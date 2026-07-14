#!/usr/bin/env bash
#
# wbs-tool を macOS の launchd 常駐サービスとして登録する（冪等）。
# 事前に SPA の本番ビルドが必要: リポジトリルートで `npm run prod:prepare` を実行しておくこと。
# DB のマイグレーションはサーバ起動時に自動適用されるため、ここでは実施しない。
#
set -euo pipefail

LABEL="com.wbstool.server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEMPLATE="${SCRIPT_DIR}/${LABEL}.plist.template"
PLIST_DST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs"
# 待受ポート（plist の EnvironmentVariables PORT と以降の表示に共通利用）。
# 例: PORT=8080 bash deploy/launchd/install.sh
PORT="${PORT:-5174}"
# 可変データ（SQLite）の保存先。リポジトリ外に置き、更新・git 操作と分離する。
# 例: WBS_TOOL_DATA_DIR=/path/to/data bash deploy/launchd/install.sh
DATA_DIR="${WBS_TOOL_DATA_DIR:-${HOME}/.wbs-tool}"
DB_PATH="${DATA_DIR}/wbs.sqlite"
WEB_DIST="${REPO_ROOT}/apps/web/dist"

NODE_BIN="$(command -v node || true)"
if [ -z "${NODE_BIN}" ]; then
  echo "ERROR: node が PATH に見つかりません。" >&2
  exit 1
fi
if [ ! -f "${REPO_ROOT}/apps/server/src/index.ts" ]; then
  echo "ERROR: サーバのエントリポイントがありません: apps/server/src/index.ts" >&2
  exit 1
fi
# サーバは tsx ローダ経由で実行する（ESM + workspace .ts import のため。dev と同方式）
if [ ! -e "${REPO_ROOT}/node_modules/tsx" ] && [ ! -e "${REPO_ROOT}/node_modules/.bin/tsx" ]; then
  echo "ERROR: tsx が見つかりません。先に 'npm ci' を実行してください。" >&2
  exit 1
fi
if [ ! -f "${WEB_DIST}/index.html" ]; then
  echo "ERROR: フロントのビルド成果物がありません: apps/web/dist/index.html" >&2
  echo "       先にリポジトリルートで 'npm run prod:prepare' を実行してください。" >&2
  exit 1
fi

mkdir -p "${HOME}/Library/LaunchAgents" "${LOG_DIR}" "${DATA_DIR}"

# テンプレートの placeholder を実際のパスへ置換（区切りに | を使うのでパス中の / は安全）
sed -e "s|__NODE_BIN__|${NODE_BIN}|g" \
    -e "s|__REPO_ROOT__|${REPO_ROOT}|g" \
    -e "s|__LOG_DIR__|${LOG_DIR}|g" \
    -e "s|__PORT__|${PORT}|g" \
    -e "s|__DB_PATH__|${DB_PATH}|g" \
    -e "s|__WEB_DIST__|${WEB_DIST}|g" \
    "${TEMPLATE}" > "${PLIST_DST}"

# 既存があればアンロードしてから再ロード（設定更新を確実に反映）
launchctl unload "${PLIST_DST}" 2>/dev/null || true
launchctl load -w "${PLIST_DST}"

echo "✓ 登録しました: ${PLIST_DST}"
echo "  node:   ${NODE_BIN}"
echo "  repo:   ${REPO_ROOT}"
echo "  port:   ${PORT}"
echo "  data:   ${DB_PATH}"
echo "  web:    ${WEB_DIST}"
echo "  logs:   ${LOG_DIR}/wbs-tool.out.log / .err.log"
echo
echo "状態:"
launchctl list | grep "${LABEL}" || echo "  (まだ一覧に出ていません。数秒後に再確認してください)"
echo
echo "ヘルスチェック: curl -s http://localhost:${PORT}/healthz"
echo "アプリを開く:   open http://localhost:${PORT}"
