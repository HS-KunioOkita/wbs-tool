# Quality Gate Rules

## Goal

実装・レビュー・テスト工程において、
リリース可能品質を維持するための品質基準を定義する。

---

# Required Quality Gates

以下をすべて満たすこと。

## 1. Formatter

- Formatter が適用済みであること
- フォーマット差分が残っていないこと

## 2. Linter

- Linter Error が 0 件であること
- Warning は許容理由が明示されていること

## 3. Type Check

- 型チェックエラーが 0 件であること

## 4. Unit Test

- Critical / High 優先度の単体テストが成功していること
- 主要業務ルールが確認されていること

## 5. E2E Test

- 主要業務フローが成功していること
- リリースブロッカー経路が成功していること

## 6. Security

- 権限外アクセスが不可能であること
- 重大なセキュリティ問題が残っていないこと

## 7. Review

- 実装レビュー完了
- テストレビュー完了
- 設計との乖離がレビュー済み

---

# Release Blockers

以下が存在する場合はリリース不可。

- Linter Error
- 型エラー
- Critical 不具合
- High 不具合（未承認）
- 主要 E2E 失敗
- データ破壊
- 権限逸脱
- 非機能要件未達
- ログ・監視不足による運用不能

---

# CI Requirements

CI では必ず以下を実行する。

- Formatter Check
- Linter
- Type Check
- Unit Test
- E2E Test（必要範囲）
- Build Verification

---

# Final Rule

「動く」だけでは不十分。

以下を満たして初めてリリース可能とする。

- 設計を満たす
- テストで確認されている
- 品質ゲートを通過している
- 運用可能である
