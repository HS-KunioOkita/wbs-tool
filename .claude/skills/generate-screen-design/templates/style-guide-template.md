# スタイルガイド

本ドキュメントはスタイルガイドのテンプレートである。`docs/design/screen/style-guide.md` として配置し、各章を埋める。章の順序は固定（方針 → トークン → コンポーネント → アクセシビリティ → ブランド → 注意事項）。画面ごとの詳細仕様（レイアウト・状態・動的挙動 等）は `docs/design/screen/UI-NNN-*/screen.md` 側で扱う。

- 対象システム名: {{SYSTEM_NAME}}
- 対応する要件定義書: [`docs/requirements/functional.md`](../../requirements/functional.md) / [`docs/requirements/non-functional.md`](../../requirements/non-functional.md)
- 対応する HCD / UI・UX 設計書: [`docs/design/uiux/uiux-design.md`](../uiux/uiux-design.md)
- 対応するインタフェース設計書: [`docs/design/interface/interface-design.md`](../interface/interface-design.md)
- 作成日 / 最終更新日: YYYY-MM-DD / YYYY-MM-DD
- 版: 0.1（ドラフト）

---

## 1. スタイル設計方針

本スタイルガイド全体を貫く方針を箇条書きで示す。論理スタイル基盤レベルの判断のみを扱い、製品選定や具体ライブラリ・CSS 変数名には踏み込まない。HCD / UI・UX 設計書 1 章「UX 設計方針」と整合させること。

- **デザイン言語の出発点**: {{視覚的トーンの宣言（例: 「信頼性重視・情報密度高め・装飾最小限」）。対応する PER-NNN・SCN-NNN・要件ブランド要件を参照}}
- **カラーシステムの設計原則**: {{ブランドカラーと意味カラーの区別、中間階調の生成方針、ダークモード方針}}
- **タイポグラフィスケール**: {{見出しと本文のサイズ階層、スケール比、フォントファミリ種別と用途}}
- **スペーシング原則**: {{基底単位（4px / 8px）、密度レベル（コンフォート / スタンダード / コンパクト）}}
- **コンポーネント設計原則**: {{プリミティブとコンポジットの区別、バリエーション増殖の歯止め}}
- **モーション原則**: {{過度な動きの抑制、prefers-reduced-motion 対応、duration・easing の論理名と意味}}
- **アクセシビリティ最低基準**: {{WCAG 準拠レベル（AA / AAA）、コントラスト比下限、フォーカスリング常時表示、キーボード操作原則。HCD 側 A11Y-NNN を根拠に}}
- **ダークモード方針**: {{採用 / 非採用 / 将来採用、採用時のトークン命名方針}}
- **拡張ポリシー**: {{トークン・コンポーネントの追加手順、画面側での場当たり定義の禁止}}
- **非対応ブラウザ・環境**: {{サポート対象ブラウザ・画面幅下限・高密度ディスプレイ対応}}

---

## 2. デザイントークン

トークンは論理名 + 代表値までを本ドキュメントで決め、CSS 変数名・Tailwind 設定・SCSS 変数への反映は実装側で行う。

### 2.1 カラートークン

| DTK-NNN | 論理名 | 役割 | ライト値 | ダーク値 | コントラスト確保対象 | 由来 |
|---|---|---|---|---|---|---|
| DTK-001 | color.brand.primary | ブランド | #2563EB | #60A5FA | color.text.onPrimary と AA 以上 | ブランド要件 |
| DTK-002 | color.brand.secondary | ブランド |   |   |   |   |
| DTK-0XX | color.semantic.success | 意味 |   |   |   | ERR 分類: 成功 |
| DTK-0XX | color.semantic.warning | 意味 |   |   |   | ERR 分類: 警告 |
| DTK-0XX | color.semantic.danger | 意味 |   |   |   | ERR 分類: エラー |
| DTK-0XX | color.semantic.info | 意味 |   |   |   | ERR 分類: 情報 |
| DTK-0XX | color.gray.050 | 中間階調 |   |   |   |   |
| DTK-0XX | color.gray.100 〜 900 | 中間階調 |   |   |   |   |
| DTK-0XX | color.background | 背景 |   |   |   |   |
| DTK-0XX | color.surface | 表面 |   |   |   |   |
| DTK-0XX | color.surface.raised | 表面 |   |   | エレベーション階層と連動 |   |
| DTK-0XX | color.text.primary | テキスト |   |   | color.background と AA |   |
| DTK-0XX | color.text.secondary | テキスト |   |   |   |   |
| DTK-0XX | color.text.disabled | テキスト |   |   |   |   |
| DTK-0XX | color.text.inverse | テキスト |   |   |   |   |
| DTK-0XX | color.border | ボーダー |   |   |   |   |
| DTK-0XX | color.overlay | オーバーレイ |   |   |   |   |

メモ:
- ダークモード採用しない場合は「ダーク値」列ごと省略してよい（1 章で宣言）。
- コントラスト比は WCAG 計算に基づく参考値を注記できる。厳密検証は実装・QA 工程。

### 2.2 タイポグラフィトークン

| DTK-NNN | 論理名 | 用途 | フォント種別 | サイズ | 行間 | 文字間隔 | 太さ | 備考 |
|---|---|---|---|---|---|---|---|---|
| DTK-0XX | heading.h1 | 見出し | サンセリフ | 32 | 1.25 | -0.01em | 700 |   |
| DTK-0XX | heading.h2 〜 h6 | 見出し |   |   |   |   |   |   |
| DTK-0XX | body.lg | 本文 |   |   |   |   |   |   |
| DTK-0XX | body.md | 本文（既定） |   |   |   |   |   |   |
| DTK-0XX | body.sm | 本文 |   |   |   |   |   |   |
| DTK-0XX | caption | キャプション |   |   |   |   |   |   |
| DTK-0XX | label | ラベル |   |   |   |   |   |   |
| DTK-0XX | numeric | 数値表示 | 等幅 |   |   |   |   | 金額・表で使う |

**多言語時のフォールバック方針**: {{CJK と英数字でフォールバック順があるなら明示。例: 「日本語主・英数字は Inter、見出しは Noto Sans JP フォールバック」}}

### 2.3 スペーシングトークン

| DTK-NNN | 論理名 | 値 | 主な用途 |
|---|---|---|---|
| DTK-0XX | space.0 | 0 |   |
| DTK-0XX | space.1 | 4px | インライン間隔 |
| DTK-0XX | space.2 | 8px | スタック間隔 |
| DTK-0XX | space.3 | 12px |   |
| DTK-0XX | space.4 | 16px | 既定の余白 |
| DTK-0XX | space.6 | 24px |   |
| DTK-0XX | space.8 | 32px | セクション間隔 |
| DTK-0XX | space.12 | 48px |   |
| DTK-0XX | space.16 | 64px |   |

**グリッド**: {{コンテナ最大幅・カラム数・ガター幅の原則。ブレークポイント別の差があればここで宣言}}

### 2.4 エレベーション・角丸・ボーダー

| DTK-NNN | 論理名 | 値 | 主な用途 |
|---|---|---|---|
| DTK-0XX | elevation.0 | なし | フラット |
| DTK-0XX | elevation.1 | 0 1px 2px rgba(0,0,0,0.08) | カード |
| DTK-0XX | elevation.2 |   | ポップオーバー |
| DTK-0XX | elevation.3 |   | モーダル |
| DTK-0XX | elevation.4 |   | トースト |
| DTK-0XX | radius.none | 0 |   |
| DTK-0XX | radius.sm | 4px |   |
| DTK-0XX | radius.md | 8px | 既定のカード |
| DTK-0XX | radius.lg | 16px |   |
| DTK-0XX | radius.full | 9999px | 円形・ピル |
| DTK-0XX | border.thin | 1px |   |
| DTK-0XX | border.base | 2px |   |
| DTK-0XX | border.thick | 4px |   |

ダークモード時のエレベーション扱い: {{シャドウを強める / 表面色で段階表現 / 両方 のいずれか}}

### 2.5 モーショントークン

| DTK-NNN | 論理名 | 値 | 主な用途 |
|---|---|---|---|
| DTK-0XX | motion.fast | 100ms | hover / focus 反応 |
| DTK-0XX | motion.base | 200ms | 状態遷移 |
| DTK-0XX | motion.slow | 400ms | ページレベル遷移 |
| DTK-0XX | ease.standard | cubic-bezier(0.2, 0, 0, 1) |   |
| DTK-0XX | ease.emphasize |   | 強調の進入 |
| DTK-0XX | ease.decelerate |   | 離脱 |
| DTK-0XX | ease.accelerate |   | 進入 |

**`prefers-reduced-motion` 時の扱い**: {{全 duration を 0ms 相当に短縮 / 大きな動きのみ無効化 / 特定カテゴリ以外は維持、のいずれか}}

### 2.6 ブレークポイント

| DTK-NNN | 論理名 | 下限幅 | 想定端末種別 | コンテナ幅 | カラム数 |
|---|---|---|---|---|---|
| DTK-0XX | bp.sm | 0 | スマートフォン縦 | 100% | 4 |
| DTK-0XX | bp.md | 640px | スマートフォン横 / 小型タブレット |   | 6 |
| DTK-0XX | bp.lg | 1024px | タブレット |   | 8 |
| DTK-0XX | bp.xl | 1280px | デスクトップ |   | 12 |
| DTK-0XX | bp.2xl | 1536px | 広幅デスクトップ |   | 12 |

**記述方式**: モバイルファースト / デスクトップファーストのいずれか（1 章方針と整合）。

---

## 3. コンポーネントカタログ

### 3.1 コンポーネント一覧

| CMP-NNN | 名称 | 分類 | 主な用途 | バリエーション数 | 依存 CMP | 依存 DTK | 備考 |
|---|---|---|---|---|---|---|---|
| CMP-001 | Button | プリミティブ | クリック動作 | 5 (primary / secondary / ghost / danger / link) | - | color, typography, space, radius |   |
| CMP-002 | TextField | プリミティブ | テキスト入力 | 3 (default / filled / outlined) | - |   |   |
| CMP-0XX | Select | プリミティブ |   |   |   |   |   |
| CMP-0XX | Checkbox | プリミティブ |   |   |   |   |   |
| CMP-0XX | Radio | プリミティブ |   |   |   |   |   |
| CMP-0XX | Switch | プリミティブ |   |   |   |   |   |
| CMP-0XX | FormField | コンポジット | Label + Input + Error |   | TextField, Label |   |   |
| CMP-0XX | Card | コンポジット |   |   |   |   |   |
| CMP-0XX | Table | コンポジット |   |   |   |   |   |
| CMP-0XX | Modal | コンポジット | ブロッキング対話 |   |   |   |   |
| CMP-0XX | Drawer | コンポジット |   |   |   |   |   |
| CMP-0XX | Tabs | コンポジット |   |   |   |   |   |
| CMP-0XX | Stack | レイアウト | 縦方向の積み |   |   |   |   |
| CMP-0XX | Inline | レイアウト |   |   |   |   |   |
| CMP-0XX | Grid | レイアウト |   |   |   |   |   |
| CMP-0XX | Container | レイアウト |   |   |   |   |   |
| CMP-0XX | Toast | フィードバック | 非ブロッキング通知 |   |   |   |   |
| CMP-0XX | Alert | フィードバック |   |   |   |   |   |
| CMP-0XX | Banner | フィードバック |   |   |   |   |   |
| CMP-0XX | ProgressBar | フィードバック |   |   |   |   |   |
| CMP-0XX | Spinner | フィードバック |   |   |   |   |   |
| CMP-0XX | Skeleton | フィードバック | 読込中表示 |   |   |   |   |
| CMP-0XX | Header | ナビゲーション |   |   |   |   |   |
| CMP-0XX | Sidebar | ナビゲーション |   |   |   |   |   |
| CMP-0XX | Breadcrumb | ナビゲーション |   |   |   |   |   |
| CMP-0XX | Pagination | ナビゲーション |   |   |   |   |   |

### 3.2 各コンポーネント仕様

以下のサブテンプレートをコンポーネントごとに繰り返す。

#### CMP-001 Button

- **概要**: {{1〜2 文}}
- **用途・原則**: {{使う場面・使わない場面・類似コンポーネントとの使い分け。例: 「遷移は Link、動作は Button」}}

**バリアント**:

| バリアント | 役割・意味 | 使用 DTK | 用法制約 |
|---|---|---|---|
| primary | 主 CTA | color.brand.primary, color.text.onPrimary | 1 画面 1 つまで |
| secondary | 副 CTA |   |   |
| ghost | 無強調操作 |   |   |
| danger | 破壊的操作 | color.semantic.danger |   |
| link | テキスト動作 |   | 見た目はリンク、振る舞いはボタン |

**サイズ**:

| サイズ | 適用 DTK | 主な用途 |
|---|---|---|
| sm | space.2, body.sm | 密なテーブル内 |
| md | space.3, body.md | 既定 |
| lg | space.4, body.lg | ヒーロー |

**状態**:

| 状態 | 視覚変化 | 備考 |
|---|---|---|
| default |   |   |
| hover | 背景を 8% 暗く |   |
| focus | フォーカスリング表示（radius.sm, color.brand.primary 2px outset） | キーボード経由でも表示 |
| active | 背景を 16% 暗く |   |
| disabled | 不透明度 40%, cursor not-allowed |   |
| loading | ラベル非表示 + Spinner 内蔵, disabled 相当 |   |

**要素構成**: `icon-leading` / `label` / `icon-trailing`（各オン/オフ可）

**入出力契約**: onClick（主）/ onFocus / onBlur。具体 prop 名は実装。

**アクセシビリティ**: role は button（既定）、disabled 時は `aria-disabled`、loading 時は `aria-busy`。キーボード: Enter / Space で起動、Tab でフォーカス。

**レスポンシブ挙動**: モバイル時に親がフォーム用の場合 full width、画面ヘッダ内では固定幅を維持。

**使用可否の制約**: {{例: 「ページ内に primary を複数置かない」}}

**関連コンポーネント**: Link（遷移用）、IconButton（アイコンのみ）

#### CMP-0XX {{次のコンポーネント}}

（以下同じサブテンプレートを繰り返し）

---

## 4. アクセシビリティ方針（具体値への落とし込み）

本章は HCD / UI・UX 設計の `A11Y-NNN`（論理方針）を具体値と視覚仕様に落とす。

### A11Y-NNN ごとの具体化対応表

| A11Y-NNN | HCD 側方針（要約） | 本章での具体化内容 | 関連 DTK / CMP |
|---|---|---|---|
| A11Y-001 | {{HCD 側の方針}} | {{具体値: コントラスト 4.5:1 以上、フォーカスリング 2px、タッチターゲット 44px}} | color, space, focus |
| A11Y-00X |   |   |   |

### 具体基準

- **準拠レベル**: {{WCAG 2.1 AA / 項目別 AAA がある場合明記}}
- **コントラスト比**: 通常テキスト 4.5:1 以上、大型テキスト（18pt 以上 or 14pt 太字）3:1 以上、UI コンポーネント 3:1 以上。違反組合せは使用禁止として記録。
- **キーボード操作**: {{Tab 順序方針、フォーカスリング常時表示、モーダルのフォーカストラップ、Escape のキャンセル原則、ショートカット衝突回避方針}}
- **スクリーンリーダー**: {{ARIA ロール・ラベル・ライブリージョンの使用方針、alt テキスト方針、状態変化通知方針}}
- **可読性**: 最小フォントサイズ {{14px / 16px}}、行間 {{1.5 以上}}、段落幅上限 {{日本語 40〜50 文字・英語 60〜80 文字}}
- **タッチターゲット**: 最小 44×44px、ターゲット間余白 {{8px}}
- **動きへの配慮**: `prefers-reduced-motion` 尊重、自動再生禁止、点滅禁止（3Hz 超の発作誘発禁止）
- **音の扱い**: 自動音声再生禁止、音のみで情報を伝えない
- **言語切替・読み上げ**: {{言語タグ適用方針、多言語混在時のラベル付け方針}}
- **対象外の JOB**: {{HCD 側で対象外とした JOB-NNN を再掲、代替手段があれば記載}}

---

## 5. ブランド運用ルール

- **ロゴ**: {{最小表示サイズ・クリアスペース・使用可能背景色・禁則}}
- **画像・写真方針**: {{彩度・トーン・人物の写り方}}
- **イラスト方針**: {{線の太さ・塗り・色彩使用}}
- **アイコン方針**: {{線 / 塗り / 両対応、太さ、コーナー処理}}
- **文言トーン**: {{ですます / だ・である、カジュアル / フォーマル、業務用語の統一、禁止用語}}
- **禁止事項**: {{ブランド毀損となる具体例の列挙}}

---

## 6. 注意事項

### 6.1 リスク・懸念点

| RISK-NNN | 内容 | 影響範囲 | 顕在化条件 | 暫定対応 | 実装・運用への申し送り |
|---|---|---|---|---|---|
| RISK-001 |   |   |   |   |   |
| RISK-002 |   |   |   |   |   |

### 6.2 代替案と採らない理由

| ALT-NNN | 対象判断 | 代替案概要 | 採らない理由 | 再検討条件 |
|---|---|---|---|---|
| ALT-001 | カラースケール生成 | アルゴリズム生成（OKLCH） | 既存手動調整との差分を検証する工数がない | 大幅リブランド時 |
| ALT-002 | ダークモード |   |   |   |
| ALT-003 | スペーシング基底 | 4 vs 8 |   |   |
| ALT-004 | タイポグラフィスケール | 線形 vs モジュラー |   |   |
| ALT-005 | ブレークポイント数 |   |   |   |
| ALT-006 | アイコン |   |   |   |
| ALT-007 | 密度レベル |   |   |   |

### 6.3 後続工程への申し送り事項

**実装への申し送り**:

| HO-I-NNN | 内容 | 想定選択肢 | 決定責任者 | 相談先 |
|---|---|---|---|---|
| HO-I-001 | CSS 変数名・Tailwind 設定・SCSS 変数のマッピング | CSS Variables / Tailwind / SCSS |   |   |
| HO-I-002 | コンポーネントライブラリ採用の是非 | shadcn-ui / MUI / Chakra / 自前 |   |   |
| HO-I-003 | アイコンライブラリ選定 | Lucide / Heroicons / Tabler |   |   |
| HO-I-004 | フォント配信方式 | Google Fonts / セルフホスト / 可変フォント |   |   |
| HO-I-005 | ダークモード実装 | CSS 変数切替 / data 属性 / class 切替 |   |   |
| HO-I-006 | i18n ライブラリ・メッセージキー命名規則 |   |   |   |

**QA・テスト設計への申し送り**:

| HO-T-NNN | 内容 | 想定選択肢 | 決定責任者 | 相談先 |
|---|---|---|---|---|
| HO-T-001 | ビジュアルリグレッションテスト対象の範囲 |   |   |   |
| HO-T-002 | アクセシビリティ自動テスト（axe 等）の CI 組込 |   |   |   |
| HO-T-003 | 手動スクリーンリーダー検証の対象画面・頻度 |   |   |   |
| HO-T-004 | コントラスト比の自動検査 |   |   |   |

**HCD / UI・UX 設計への逆流候補**:

| HO-U-NNN | 内容 | 逆流理由 | 相談先 |
|---|---|---|---|
| HO-U-001 |   |   |   |
