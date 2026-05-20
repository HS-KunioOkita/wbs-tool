# リリース判定記録（Phase 8.5 / T-085）

最終更新: 2026-05-19

実装計画 [implementation-plan.md §10](implementation-plan.md#10-リリース判定基準) の判定表を本書でセルフチェックする。

## 判定結果サマリ

**判定: リリース可（Release Blocker 不在）**

- 必須項目すべて ✓
- §10.1 Release Blocker 一覧の事象は 0 件
- §11 OPEN-01 / OPEN-02 / OPEN-03（High 優先度）はすべて確定済み

## 判定表チェック結果

| 判定項目                 | 合格基準                                                                                               | 結果 | エビデンス                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 設計トレーサビリティ     | 全 UC / UI / API / CLS / RULE / VR / ERR が実装タスクに紐付けられ、§3 の関連設計 ID が PR 履歴で追える | ✓    | [design-divergence-review.md](design-divergence-review.md) §2 で UC/UI/API/CLS 全項目を実装ファイル・テストファイルにマッピング                |
| Formatter                | 差分なし                                                                                               | ✓    | `npm run format:check` → "All matched files use Prettier code style!"                                                                          |
| Linter                   | Error 0 / Warning は理由明示済み                                                                       | ✓    | `npm run lint` → max-warnings 0 で成功                                                                                                         |
| Type Check               | エラー 0                                                                                               | ✓    | `npm run typecheck` → server / web / shared すべて成功                                                                                         |
| Unit Test                | §7 の Critical / High が全成功                                                                         | ✓    | server 98 件 + web 69 件 = 計 167 件 green                                                                                                     |
| E2E                      | E2E-01〜04 / E2E-06 / E2E-08 が成功                                                                    | ✓    | 全 15 件（E2E-01〜08 + A11Y）green。NFR-001 必須項目に含まれる E2E-08 も成功                                                                   |
| NFR-001 実測             | T-081 で 500 × 1,000 規模で初期 2 秒・操作 1 秒以内                                                    | ✓    | E2E-08 実測: **initial 229ms / granularity_switch 126ms**（目標 2,000ms / 1,000ms を大幅クリア）                                               |
| セキュリティ             | パラメタライズドクエリ徹底、XSS 対策、CORS / Same-Origin が `localhost` 限定で機能                     | ✓    | DAO は `db.prepare(...)` でプレースホルダ統一、React 自動エスケープ、CORS は localhost / 127.0.0.1 限定（`apps/server/src/http/server.ts:34`） |
| ロギング・相関 ID        | ERR-005 / ERR-006 で相関 ID が画面と一致してログに残る                                                 | ✓    | Fastify `genReqId` で UUID v4、`X-Correlation-Id` ヘッダ、`error-handler.ts` でレスポンス body / トーストとログを同 ID で出力                  |
| SQLite 整合性            | 起動時 `PRAGMA integrity_check` が機能、破損時に利用者通知                                             | ✓    | `apps/server/src/db/connection.ts` で `runIntegrityCheck` 既定 ON、破損時 `PersistenceFailureError`                                            |
| マイグレーション         | スキーマ移行が起動時に適用、`schema_version` が記録される                                              | ✓    | `apps/server/src/db/migrations/runner.ts` で起動時自動適用、`schema_version` テーブルに版数記録                                                |
| ドキュメント             | README に起動・停止・バックアップ・ログ確認手順が記載                                                  | ✓    | [README.md](../README.md) に起動・停止・環境変数・DB・バックアップ・ログ確認手順・ローテーション運用方針を網羅                                 |
| アクセシビリティ最低基準 | キーボードで主要 CRUD が完結、フォーカスリング、コントラスト AA                                        | ✓    | [e2e/e2e-a11y-keyboard.spec.ts](../e2e/e2e-a11y-keyboard.spec.ts) でキーボード CRUD を E2E 確認、`base.css` で `:focus-visible` リング         |
| OPEN 事項                | §11 の High 項目（OPEN-01〜03）はすべて確定済み                                                        | ✓    | OPEN-01 期間重み付き平均 / OPEN-02 直前値保持 + 編集可能化 / OPEN-03 起動時自動適用 すべて確定                                                 |
| E2E-09 / E2E-10          | エラー復旧 / 起動失敗の挙動確認                                                                        | 任意 | T-064（ポート競合フォールバック） / T-065（破損検知）の単体実装で代替。本リリースでは E2E 化保留                                               |

## §10.1 Release Blocker 一覧チェック

すべて **0 件**:

- [x] Linter Error / 型エラー: なし
- [x] Critical 不具合 / 未承認の High 不具合: なし（本セッションで発見した DELETE Content-Type バグは E2E 整備中に検出して即修正、回帰防止済み）
- [x] E2E-01〜04 / E2E-06 / E2E-08 のいずれかが失敗: 失敗なし
- [x] データ破壊・親派生値の不整合・FK 違反の混入: なし（domain unit テストと API integration テストで網羅）
- [x] `localhost` 外からのアクセスが遮断できていない: CORS でホスト名限定済み
- [x] NFR-001 未達 / NFR-002 規模で動作しない: 230ms / 130ms で達成
- [x] ERR-005 / ERR-006 で相関 ID が出力されない: error-handler.ts でログ・レスポンスとも相関 ID 付与
- [x] スキーマ移行に失敗した状態でアプリが起動してしまう: 失敗時は throw して `main()` の catch で exit(1)
- [x] §11 OPEN-01 / OPEN-02 / OPEN-03 未確定: すべて確定済み

## 軽微な乖離（リリースを妨げない）

詳細は [design-divergence-review.md §3](design-divergence-review.md#3-検出した乖離--補足事項) 参照:

1. ログローテーション: アプリ自動化は無し → README で `logrotate` 委譲方針を明記
2. T-058 性能最適化: 不要判定（NFR-001 を実装なしでクリア）
3. T-066 ログ確認手順: README で記載完了
4. API DELETE Content-Type バグ: 本セッションで修正 + E2E で回帰防止

## サインオフ

- 設計レビュー: [design-divergence-review.md](design-divergence-review.md) を参照
- 品質ゲート: 上記表すべて ✓
- リリース判定: **可**
- 申し送り: PLAN-RISK-04（E2E-08 nightly 運用）、NFR-005 完全準拠は今後の改善項目（最低基準は満たす）

判定者: 実装エンジニア (セルフレビュー)
日時: 2026-05-19
