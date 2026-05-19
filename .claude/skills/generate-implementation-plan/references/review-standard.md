# Review Standard

## Goal
設計通りに実装されていることを確認する。

---

# Review Principles

- レビューは品質向上のために行う
- 個人批判をしない
- 設計意図を確認する
- 長期保守性を重視する

---

# Review Targets

## Design Alignment
- 設計と一致しているか
- 責務分離されているか
- 命名が適切か

## Security
- 権限漏れがないか
- 入力検証されているか
- 秘密情報が漏れないか

## Error Handling
- エラー処理が適切か
- ログが残るか
- ユーザーが復旧できるか

## Testing
- テストが不足していないか
- 業務ルールを確認しているか
- E2E が主要フローを確認しているか

## Maintainability
- 可読性
- 拡張性
- 依存方向
- 重複

---

# Review Output Rules

レビューでは以下を分類する。

- Critical
- High
- Medium
- Low
- Suggestion

---

# Blocking Conditions

以下はマージ不可。

- Critical 問題
- High 問題（未承認）
- テスト不足
- セキュリティ問題
- 設計逸脱