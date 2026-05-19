# Coding Standard

## Goal

可読性・保守性・レビュー容易性を高める。

---

# General Principles

- 読みやすさを最優先する
- 意図が分かる命名を行う
- 暗黙知を避ける
- Magic Number を避ける
- コメントよりコードで表現する

---

# Architecture Principles

- 責務分離を守る
- UI / API / Domain / Infrastructure を分離する
- 依存方向を明確にする
- 循環依存を禁止する

---

# Function Rules

- 関数は単一責務にする
- 関数は短く保つ
- 副作用を明示する
- 入出力を明確にする

---

# Error Handling

- エラーを握りつぶさない
- ログを残す
- ユーザー向けエラーと内部エラーを分離する

---

# Naming Rules

- 略語を避ける
- ドメイン用語を優先する
- Boolean は is/has/can を使う

---

# Testing Rules

- 実装コードと同等以上にテスト可読性を重視する
- 業務ルールは必ずテストする
- テスト名から期待動作が分かるようにする

---

# Forbidden

- 巨大クラス
- 巨大関数
- copy & paste
- hidden side effect
- 不要な abstraction
- premature optimization
