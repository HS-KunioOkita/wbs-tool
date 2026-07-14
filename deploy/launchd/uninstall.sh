#!/usr/bin/env bash
#
# wbs-tool の launchd 常駐サービスを停止・解除する。
# データ（~/.wbs-tool 等）を削除するかはインタラクティブに確認する。
#   - 非対話実行で削除したい場合: PURGE_DATA=true bash deploy/launchd/uninstall.sh
#   - データ場所は plist の DB_PATH から導出（無ければ WBS_TOOL_DATA_DIR / 既定 ~/.wbs-tool）
#
set -euo pipefail

LABEL="com.wbstool.server"
PLIST_DST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

# plist の DB_PATH（<string>...</string>）からデータディレクトリを導出する。
derive_data_dir_from_plist() {
  [ -f "${PLIST_DST}" ] || return 1
  local db
  db="$(grep -A1 '<key>DB_PATH</key>' "${PLIST_DST}" \
        | sed -n 's|.*<string>\(.*\)</string>.*|\1|p' | head -1)"
  [ -n "${db}" ] || return 1
  dirname "${db}"
}

DATA_DIR="$(derive_data_dir_from_plist || true)"
[ -n "${DATA_DIR:-}" ] || DATA_DIR="${WBS_TOOL_DATA_DIR:-${HOME}/.wbs-tool}"

# ── サービス解除 ──
if [ -f "${PLIST_DST}" ]; then
  launchctl unload "${PLIST_DST}" 2>/dev/null || true
  rm -f "${PLIST_DST}"
  echo "✓ 解除しました: ${PLIST_DST}"
else
  echo "プロファイルが見つかりません（既に解除済み）: ${PLIST_DST}"
fi

# ── データ削除の確認 ──
if [ -d "${DATA_DIR}" ]; then
  if [ "${PURGE_DATA:-}" = "true" ]; then
    rm -rf "${DATA_DIR}"
    echo "✓ データを削除しました: ${DATA_DIR}"
  elif [ -t 0 ]; then
    printf "データ (%s) も削除しますか？ [y/N]: " "${DATA_DIR}"
    read -r ans || ans=""
    case "${ans}" in
      y | Y | yes | YES)
        rm -rf "${DATA_DIR}"
        echo "✓ データを削除しました: ${DATA_DIR}"
        ;;
      *)
        echo "データは保持します: ${DATA_DIR}"
        ;;
    esac
  else
    echo "データは保持します（非対話実行）: ${DATA_DIR}"
    echo "  削除する場合: PURGE_DATA=true bash deploy/launchd/uninstall.sh"
  fi
else
  echo "データディレクトリはありません: ${DATA_DIR}"
fi
