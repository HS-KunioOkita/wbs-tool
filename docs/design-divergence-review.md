# 設計乖離レビュー記録（Phase 8.2 / T-082）

最終更新: 2026-05-19

実装と設計（[basic-design.md](design/basic-design.md) ほか各個別設計書）との突合結果。

## 1. ステータスサマリ

- 設計に対する **重大な乖離は無し**（Release Blocker 該当事象なし）
- 一部の **設計記載漏れ / 軽微な実装漏れ** を本ドキュメントで明示
- 軽微な実装漏れは README で運用回避策を明記し、リリース判定に影響しない

## 2. 設計 ID → 実装トレーサビリティ

### 2.1 ユースケース (UC) → E2E

| UC                           | E2E                                                                      | 備考                                 |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| UC-001 プロジェクト管理      | E2E-01, E2E-06                                                           | 作成/削除フローを E2E でカバー       |
| UC-002〜004, 007 タスク      | E2E-01, E2E-02, E2E-04, E2E-06                                           | CRUD + 親派生値 + ドラッグ期間変更   |
| UC-005 依存関係              | E2E-03                                                                   | 追加 / 削除 / 循環拒否               |
| UC-006 ガント表示            | E2E-07, E2E-08                                                           | 粒度切替 / 依存線 ON-OFF / 性能      |
| UC-007 ドラッグで期間変更    | E2E-04                                                                   | バー全体 / 左右ハンドル / 親バー抑止 |
| UC-009 PDF                   | E2E-05                                                                   | フィルタ反映 + ERR-004 抑止          |
| 主要 A11Y キーボードシナリオ | A11Y E2E ([e2e-a11y-keyboard.spec.ts](../e2e/e2e-a11y-keyboard.spec.ts)) | キーボードのみで CRUD 完結           |

### 2.2 画面 (UI) → 実装

| UI                      | 実装                                                       |
| ----------------------- | ---------------------------------------------------------- |
| UI-001 プロジェクト選択 | `apps/web/src/features/projects/ProjectSelectPage.tsx`     |
| UI-002 プロジェクト編集 | `apps/web/src/features/projects/ProjectEditDialog.tsx`     |
| UI-003 WBS メイン       | `apps/web/src/features/wbs/WbsMainPage.tsx` + `gantt/*`    |
| UI-004 タスク編集       | `apps/web/src/features/wbs/TaskEditDialog.tsx`             |
| UI-005 依存関係編集     | `apps/web/src/features/wbs/DependencyEditDialog.tsx`       |
| UI-006 フィルタ         | `apps/web/src/features/wbs/FilterPanel.tsx`                |
| UI-007〜009 PDF         | `apps/web/src/features/wbs/PdfExportDialog.tsx` + `pdf.ts` |

### 2.3 API → 実装

| API                       | 実装                                          | テスト                               |
| ------------------------- | --------------------------------------------- | ------------------------------------ |
| API-001〜005 プロジェクト | `apps/server/src/http/routes/projects.ts`     | `tests/api/projects.api.test.ts`     |
| API-006〜010 タスク       | `apps/server/src/http/routes/tasks.ts`        | `tests/api/tasks.api.test.ts`        |
| API-011〜013 依存関係     | `apps/server/src/http/routes/dependencies.ts` | `tests/api/dependencies.api.test.ts` |

### 2.4 クラス (CLS) → 実装

| CLS                        | 実装                                      |
| -------------------------- | ----------------------------------------- |
| CLS-001 タスクエンティティ | `apps/server/src/domain/task.ts`          |
| CLS-002 タスク期間 VO      | `apps/server/src/domain/task-period.ts`   |
| CLS-003 タスク進捗 VO      | `apps/server/src/domain/task-progress.ts` |
| CLS-004 プロジェクト WBS   | `apps/server/src/domain/project-wbs.ts`   |
| CLS-005 依存関係           | `apps/server/src/domain/dependency.ts`    |

### 2.5 業務ルール (RULE) / バリデーション (VR) / エラー (ERR)

すべてドメイン層実装＋単体テストで網羅:

- RULE-001〜013: `tests/domain/project-wbs.test.ts` ほか
- VR-001〜011: `packages/shared/src/validation-rules.ts` で根拠を共有、サーバ・クライアントで個別検証
- ERR-001〜006: `apps/server/src/errors/app-errors.ts` + `http/middleware/error-handler.ts`

### 2.6 非機能要件 (NFR)

| NFR                              | 実測 / 仕組み                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| NFR-001 性能                     | E2E-08 にて 500 タスク × 1,000 依存で **初期 230ms / 切替 130ms**（目標 2,000ms / 1,000ms 大幅クリア）     |
| NFR-002 スケール                 | 同上、500 タスクで業務上想定範囲内                                                                         |
| NFR-003 単独利用 / 認証          | `HOST=127.0.0.1` 既定、`@fastify/cors` で localhost オリジン限定                                           |
| NFR-004 監視基盤連携無し         | 構造化 JSON ログを標準出力 + ファイル（`LOG_PATH`）、ローテーションは外部委譲（[README.md](../README.md)） |
| NFR-005 アクセシビリティ最低基準 | `:focus-visible` でフォーカスリング、E2E でキーボード CRUD を確認                                          |

## 3. 検出した乖離 / 補足事項

### 3.1 ログローテーション（軽微）

- **設計** ([architecture.md](design/architecture/architecture.md)): COMP-008 ロギングに「ローテーション」言及あり
- **実装**: `appendFileSync` で追記のみ。アプリ自動ローテーションは未実装
- **判断**: NFR-004（単独利用 / 監視基盤連携無し）方針に照らすと、OS の `logrotate` / `newsyslog` への委譲が合理的
- **対応**: README [ログローテーション](../README.md#ログローテーション) 節で運用方針と `copytruncate` 例を明記
- **Release Blocker 該当性**: 該当せず（運用回避策あり）

### 3.2 タスク一覧 API のフラット返却（OPEN-11 既決）

- **設計** ([interface-design.md](design/interface/interface-design.md)): API-006 のレスポンス形状はツリー化 / フラット化どちらも許容
- **実装**: フラット配列を返却し、フロントで `parent_task_id` を辿ってツリー組み立て
- **判断**: 単独利用かつ 500 タスク規模で性能上問題なし（E2E-08 で実測クリア）
- **対応**: 計画 OPEN-11 は「フラット返却 + フロント側組み立て」で確定済み

### 3.3 性能最適化 T-058 不要判定

- **設計** ([interface-design.md](design/interface/interface-design.md)): 仮想スクロール / 差分再描画は OPEN-13 として保留
- **実装**: 通常の React レンダで NFR-001 を大幅クリアしたため、最適化なしで完了
- **判断**: 過剰最適化を避け、可読性を維持
- **対応**: 計画書 §12 Phase 6 Step 6.8 で「不要判定」として記録

### 3.4 API クライアント空 body DELETE の Content-Type バグ（本セッションで発見・修正）

- **症状**: フロント API クライアントが body なしの DELETE で `Content-Type: application/json` を送信
- **影響**: Fastify が "Body cannot be empty when content-type is set to 'application/json'" → ERR-001 / 400 を返却
- **検出**: E2E-03 依存関係削除テスト
- **修正**: `apps/web/src/api/client.ts` で body が無いとき Content-Type ヘッダを送らないよう変更
- **回帰防止**: E2E-03 + 他の DELETE エンドポイントを E2E でカバー（プロジェクト削除 / タスク削除）

### 3.5 VR-004 親候補からの子孫除外（UI 側で抑止）

- **設計** ([class-design.md](design/class/class-design.md)): VR-004 親変更による循環禁止
- **実装**: TaskEditDialog で自分自身 + 子孫タスクを親候補から除外（事前抑止）。API 側でも 422 で再防御
- **E2E**: E2E-02 で UI 上の親候補から子孫が除外されることを確認
- **判断**: UI レイヤ抑止 + サーバ防御の二段構え、設計通り

## 4. 残課題 / 申し送り

- **CI nightly**: 計画 PLAN-RISK-04 に記載の通り、E2E-08 性能実測は nightly 運用が望ましい
- **アクセシビリティ完全準拠**: 本実装はキーボード操作 / フォーカスリング / 色のみに依存しない表現（A11Y-001 で実施済）まで。コントラスト比の完全測定 / スクリーンリーダー対応は対象外（NFR-005 最低基準のみ）

## 5. リリース可否判定への含意

- 機能 / 業務ルール / API 契約: 設計準拠
- 非機能要件: 実測クリア
- 軽微な乖離はすべて運用回避済み、または「不要判定」として正当化済み
- 本ドキュメントの記録をもって、§10 リリース判定基準の「設計乖離レビュー記録」項目を満たす
