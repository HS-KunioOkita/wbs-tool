# Testing Standard

## Goal
リリース可能品質を保証する。

---

# Testing Strategy

## Unit Test
単体テストでは以下を確認する。

- 業務ルール
- バリデーション
- 条件分岐
- 異常系
- 境界値
- 状態遷移
- 権限

## E2E Test
E2Eでは以下を確認する。

- 主要業務フロー
- 画面遷移
- API連携
- データ保存
- 権限差分
- エラー復旧

---

# Test Quality Rules

- テストは仕様を説明できること
- テストコードは読みやすくする
- flaky test を許容しない
- 再現性を重視する

---

# Coverage Policy

Coverage 数値のみを目的にしない。

重視するもの：
- リスク
- 業務影響
- リリース影響

---

# Required Test Cases

## Unit Test Required
- 正常系
- 異常系
- 境界値
- null / undefined
- 権限差分

## E2E Required
- 初回利用
- CRUD
- 認証
- 権限
- 外部連携
- エラー復旧

---

# Non-functional Testing

必要に応じて以下を確認する。

- 性能
- セキュリティ
- 可用性
- アクセシビリティ
- ログ
- 監視