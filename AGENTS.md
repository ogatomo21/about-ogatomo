# AGENTS.md — about-ogatomo

エージェント／開発者向けの現状整理と編集指針。  
最終更新: 2026-07-15（メディアカード・画像パイプライン・Person JSON-LD 共通化）

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| 名称 | about-ogatomo |
| 種別 | 個人プロフィール／ポートフォリオ（静的・多言語） |
| 公開 URL | https://about.ogatomo.net |
| リポジトリ | https://github.com/ogatomo21/about-ogatomo |
| デプロイ | GitHub Actions → `gh-pages` ブランチ → GitHub Pages（CF Pages 移行は未実施・検討可） |
| ライセンス | MIT |
| スタック | Node.js, **Vite 6**, Tailwind CSS **v3**, PostCSS, **sharp**（画像派生） |
| 外部 CMS | **廃止**（旧 `ogcms.ogtm.workers.dev` は使わない） |

---

## 2. アーキテクチャ

```
src/data/*.json  +  src/i18n/*.json  +  src/*.html   ← 編集する正
public/images/**/*.{png,jpg,jpeg,webp}               ← 画像ソースのみ（派生は書かない）
        │
        ▼
 scripts/optimize-images.mjs  →  .tmp/images/** に .webp / .avif のみ
 scripts/inject-data.mjs      →  .tmp/*.html（マーカー埋め込み + i18n + JSON-LD）
        │
        ▼
 Vite（public コピー + HTML を dist/.tmp 経由でビルド）
        │  closeBundle: HTML を dist 直下へ / 画像パス正規化
        │              .tmp/images を dist/images へマージ（public にある同名は上書きしない）
        ▼
      dist/   ← GitHub Pages が配信（gh-pages ブランチ）
```

- **ルートの HTML は作らない。** 中間生成は `.tmp/` のみ（ソース `src/` と混同しない）。
- **実行時 CMS/API fetch はしない。** Works 等はビルド成果物に静的 HTML として含まれる（言語切替用に辞書・data JSON はクライアント JS にもバンドル）。
- Tailwind **v3** を意図的に採用（v4 は iOS 16 以下で崩れやすい）。
- **Webpack に戻さない。** バンドラは Vite のまま。

### 開発サーバー（Vite）

- ポート既定 **8080**（`host: 0.0.0.0`）。
- ルートに `index.html` は無い。生成物は `.tmp/`。
- ミドルウェア:
  - `/` → `/.tmp/index.html`
  - `/index.ja.html` 等（`GENERATED_HTML`）→ `/.tmp/...`
  - `/images/*.{avif,webp}` で public に無いもの → `.tmp/images` から配信
- **注意:** HTML 内で画像を `./images/foo.avif` のように相対指定すると、Vite が `.tmp` 上の派生を `dist/assets/*.[hash].*` にバンドルし、`dist/images` と **二重になる**。ソースでは **`/images/…`** を使い、`closeBundle` で dist 直下 HTML 向けに `./images/…` / `./assets/…` へ正規化する。

### npm scripts

| コマンド | 内容 |
|----------|------|
| `npm run images` | `public/images` → `.tmp/images` に WebP/AVIF（最大幅 2000、解像度はソース側で管理） |
| `npm run inject` | JSON → `.tmp/index.*.html` 等 |
| `npm run build` | images + inject + `vite build` → `dist/` |
| `npm run dev` | images + inject + Vite |
| `npm run preview` | `dist/` をプレビュー |
| `npm run clean` | `dist/` と `.tmp/` を削除 |

`prebuild` / `predev` は `images` → `inject` の順。

---

## 3. ディレクトリ構成

```
about-ogatomo/
├── package.json            # "type": "module"
├── vite.config.mjs         # inject プラグイン・画像ミドルウェア・dist 平坦化
├── tailwind.config.cjs
├── postcss.config.cjs
├── .github/workflows/deploy.yml
├── scripts/
│   ├── inject-data.mjs
│   └── optimize-images.mjs # sharp → .tmp/images のみ
├── src/
│   ├── index.html          # トップ（inject + data-i18n + #json-ld-person）
│   ├── works.html          # 制作物一覧
│   ├── 404.html
│   ├── css/main.css
│   ├── js/main.js
│   ├── js/i18n-runtime.js  # リロードなし言語切替 + JSON-LD 更新
│   ├── lib/content-render.js  # inject とランタイム共有（カード描画・JSON-LD）
│   ├── i18n/ja.json | en.json  # UI 文言のみ（JSON-LD の award 等は持たない）
│   └── data/
│       ├── person.json     # Person JSON-LD の正
│       ├── works.json
│       ├── links.json
│       ├── skills.json
│       ├── career.json
│       └── events.json
├── public/
│   ├── CNAME               # about.ogatomo.net
│   ├── favicon.ico
│   ├── robots.txt
│   ├── sitemap.xml
│   └── images/
│       ├── header.jpg      # ヒーロー（現状 960×480・ソースで解像度管理）
│       ├── profile-ogp.png / .webp
│       └── works/          # カード画像（制作物・イベント共通。events/ フォルダは廃止）
├── AGENTS.md
├── README.md
└── LICENSE
```

`.tmp/`・`dist/`・`node_modules/` は git 管理外。編集は常に `src/` と `public/images`（ソース画像）。

---

## 4. デザインルール（色）

`tailwind.config.cjs` の `theme.extend.colors`（RGB チャンネル + CSS 変数）:

| Token | ライト | ダーク | 用途 |
|-------|--------|--------|------|
| primary | `#7086BD` | やや明るめ | ブランド、CTA |
| secondary | `#435071` | 薄いグレー青 | 補助テキスト |
| tertiary | `#E2E6F1` | 濃い面 | セクション背景、枠 |
| surface | `#FFFFFF` | 濃いカード面 | カード等 |
| page | `#FFFFFF` | ページ背景 | ページ背景 |
| panel | `#435071` | やや明るめ | CTA など濃色パネル |
| ink | `#FFFFFF` | 同 | 濃色面の上の白文字 |
| text | `#333333` | 明るい本文 | 本文（`text-text`） |
| danger / light / green | 従来どおり | やや明るめ | 警告・リンク・資格 |

フォント: `sans-serif`（Google Fonts なし）。

**テーマ**: `html.dark` + `localStorage` キー `about-ogatomo-theme`（`system` \| `light` \| `dark`）。ヘッダーの ○○○ で切替。FOUC 防止のインライン script が `<head>` にある。

---

## 5. ページ構成

1. Hero（`#top`・全画面 `100dvh` 系）— 背景は **`<picture>`**（AVIF → WebP → `header.jpg`）。CSS `image-set` は使わない（複数フォーマットを取りにいくことがある）。上に `.hero-scrim` グラデ。
2. 自己紹介 `#about` + プロフィール `#profile`（PC 2 カラム）
3. 経歴 `#career` | スキル `#skills`（PC 2 カラム）
4. 制作物 `#works`（ホームは最新 **10** 件スライダー / 全件は `works.{ja,en}.html`）
5. イベント・受賞・資格 `#events`（スライダー）
6. リンク集 `#links`
7. CTA / Footer

### スクロールヘッダー / SP メニュー

- 要素: `#site-header` → `.site-header-inner`（**唯一の**すりガラス殻）→ `.site-header-bar` + `.header-menu-body`
- 表示: トップはヒーロー通過後 `is-visible`。ヒーロー無しページは常時表示
- すりガラス: `--glass-*` + 殻 1 枚の `backdrop-filter`。メニューに第 2 ガラス層を付けない
- **PC（md+）**: ブランド + ナビ + 言語 + テーマ。ハンバーガー非表示
- **SP**: ブランド + ハンバーガー。開くと殻が下に伸びる（`max-height`）。`border-radius` は SP で **1.5rem 固定**（開閉アニメ禁止）。言語メニュー時のみ `:has(.lang-menu.is-open)` で overflow 解除

### 制作物・イベントのカード UI

- **正方形**（`aspect-ratio: 1/1`）。上半分画像・下半分メタ + タイトル + 説明
- クラス: `.media-card` / `.media-card__media` / `.media-card__body` 等（`content-render.js` が生成）
- 見出し行は `.section-inner`（`max-w-content`）のまま。**カード列だけ**全幅（`.card-slider--wide` / `.works-card-grid`）
- 見出し下の余白: `mb-10 sm:mb-12`
- 説明テキスト: おおよそ **text-sm（0.875rem）+ leading-relaxed**。はみ出しは **line-clamp + ellipsis**。本文エリア下に padding
- スライダー（ホーム）: 幅に応じて見える枚数が増える。**最大おおよそ 5 列相当**の flex 基準
- 制作物一覧グリッド: 1 → 2 → 3 → 4 → **最大 5 列**
- 画像未設定時のフォールバック: **`/images/header.jpg`**（ヒーローと同アセット。旧 `noimage.webp` は使わない）

### i18n

- 辞書: `src/i18n/ja.json` / `en.json`（UI のみ）
- コンテンツ: `src/data/*` は `string` または `{ "ja", "en" }`
- ビルド: `index.ja.html` / `index.en.html`、ルート `index.html` は言語リダイレクト
- 切替: リロードなし（`i18n-runtime.js`）。辞書・data・`content-render` をバンドル（main.js ~39KB 前後。辞書二重持ちは意図的）
- プレースホルダ: `{{key}}` / `{{{raw}}}` + `data-i18n` / `data-i18n-attr`

自己紹介リード（ja）: 「プログラミングとテクノロジーが好きな14歳。Webアプリの制作や、初心者にも分かりやすいテック記事の執筆をしています。」  
（JSON-LD の `description.ja` と同じ文を正とする）

`index.html` inject マーカー:

```html
<!-- inject:works -->
<!-- inject:links -->
<!-- inject:skills -->
<!-- inject:career -->
<!-- inject:events -->
```

---

## 6. 画像パイプライン

| 役割 | 場所 |
|------|------|
| ソース（人が置く） | `public/images/`（カードは `works/` のみ。`events/` フォルダは廃止） |
| 派生 AVIF/WebP | **`.tmp/images/` のみ**（public に書かない） |
| 本番配信 | `dist/images/` = public コピー + `.tmp` マージ |

- ツール: `scripts/optimize-images.mjs` + **sharp**
- カード HTML: `<picture>` で `type=image/avif` → `type=image/webp` → 元ファイル `<img>`
- 外部 `https://` 画像はそのまま `<img>`
- ヒーロー解像度・品質は **ソース `header.jpg` を差し替えて管理**（ビルドでヒーロー専用に再エンコード縮小しない）
- `image` フィールド（works / events）:
  - ファイル名のみ: `"foo.jpg"` → `public/images/works/foo.jpg`（制作物・イベント共通）
  - フルパス・URL も可
  - **`public/images/events/` は廃止**（置かない）

---

## 7. JSON スキーマ

### person.json（Person JSON-LD の正・単一）

HTML に JSON-LD を直書きしない。`#json-ld-person` に inject / 言語切替で流し込む。  
組み立て: `content-render.js` の `buildPersonJsonLd` / `personJsonLdString`（inject と `i18n-runtime` 共通）。

主なフィールド:

- `name`, `alternateName`, `givenName` / `familyName`（日英オブジェクト可）
- `description`（ja/en）。ja は自己紹介リードと一致させる
- `birthDate`, `gender`（例: `https://schema.org/Male`）, `nationality`（Country）
- `address`, `jobTitle`, `knowsLanguage`, `knowsAbout`（日英配列可）
- `sameAs`, `url`
- `image`: **ImageObject**（url, contentUrl, width, height, caption 日英可）
- `award`: `{ "ja": [...], "en": [...] }`
- `mainEntityOfPage` はビルド時・言語切替時にページ canonical から付与

### works.json

```json
{
  "title": "string | { ja, en }",
  "type": "Application | Extension | Website | Library",
  "date": "YYYYMM",
  "description": "string | { ja, en }",
  "url": "https://...",
  "image": "filename.jpg（任意 → public/images/works/）"
}
```

ホーム表示件数: `WORKS_HOME_LIMIT = 10`（`content-render.js`）。

### links.json / skills.json / career.json

従来どおり（skills はカテゴリ + items。旧 stack 統合済み）。

### events.json

```json
{
  "date": "YYYY-MM",
  "title": "string | { ja, en }",
  "description": "string | { ja, en }",
  "url": "https://... | null",
  "kind": "award|qualification|media|event",
  "image": "filename.jpg（任意 → public/images/works/。制作物と共有）"
}
```

`kind` は events のみ。`image` は **works フォルダのみ**（`events/` ディレクトリは使わない）。

---

## 8. プロフィール事実（編集時の正）

| 項目 | 値 |
|------|-----|
| 氏名 | Tomoya Ogawa / 小川 智也 |
| 生年月日 | 2011-10-10 |
| 学年（2026-07 時点） | 中学3年生（14歳） |
| 所在 | Toyonaka, Osaka, Japan |
| 事業 | OgaTomo Systems（2023-07-20 設立） |
| ブログ | https://ogatomo.net |
| 資格 | ITパスポート 2024/10 合格 |
| 主な受賞 | TKGP2022 近畿決勝 / OSAKA キッズプロコン2023 総合優勝 / TKGP2023 総合優勝 |

**矛盾チェック:** 自己紹介（i18n）・`person.json`・プロフィール表・events を同時に見る。  
構造化データは **`person.json` のみ**が正。

---

## 9. デプロイ

- Workflow: `.github/workflows/deploy.yml`
- Trigger: `push` to `main` / `workflow_dispatch`
- 手順: `npm ci` → `npm run build` → `dist/` を `gh-pages` に orphan デプロイ
- Pages: **Source = gh-pages / root**
- `public/CNAME` = `about.ogatomo.net`

### Cloudflare Pages / Workers（未移行・メモ）

- このサイトは静的 `dist/` のみなので **Pages**（または Workers Static Assets）向き。
- CF 側ビルド: `npm run build` / 出力 `dist` / Node 20。`sharp` はビルド時のみ。
- ランタイムの Worker で Vite を回す必要はない。
- 移行時: `gh-pages` workflow 停止、Custom Domain、`CNAME` 整理、AGENTS 更新。

---

## 10. エージェント向けルール

1. **Tailwind は v3 のまま。** v4 へ上げない。  
2. 外部 CMS / 実行時 API 依存を再導入しない。  
3. 大規模フレームワーク（React 等）を勝手に入れない。  
4. 色はデザインルールのトークン。すりガラスは `--glass-*` と殻 1 枚。  
5. ビルド後: `dist/index.ja.html` に works 等が埋まること、`ogcms` が出ないこと、バンドラが Vite であること。  
6. **Webpack に戻さない。**  
7. **SP メニューをフルスクリーン／第 2 ガラスに戻さない。** SP の `border-radius` 開閉アニメ禁止。  
8. **画像派生を `public/` に書かない。** 解像度はソース差し替えで管理（ヒーロー専用の強制縮小を復活させない）。  
9. **カード画像パスは `/images/…` 系**（Vite が assets に二重出力しないこと）。  
10. **Person JSON-LD は `person.json` のみ。** HTML 直書き・i18n の `ldAward` 再導入禁止。  
11. 制作物ホームは **最新 10 件**。カードは正方形メディアカードを維持。  
12. 方針変更はこの AGENTS.md に追記する。

---

## 11. 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-07-14 | 初版 AGENTS（旧静的 HTML 整理） |
| 2026-07-14 | Tailwind v3 + Webpack リニューアル。CMS 廃止、JSON ビルド埋め込み、gh-pages Actions 化 |
| 2026-07-15 | 自己紹介+プロフィール PC 2 カラム。AT A GLANCE 削除 |
| 2026-07-15 | ナビ整理・ヒーロー全画面・スクロールガラスヘッダー・ダークモード・日英 i18n |
| 2026-07-15 | 言語切替リロードなし。`content-render` 共有。**Webpack → Vite 6**。生成 HTML は `.tmp/` |
| 2026-07-15 | SP ヘッダー: ハンバーガー + 殻の下方向展開。フルスクリーンメニュー廃止 |
| 2026-07-15 | Vite dev: `/` が `.tmp/index.html` を開くようミドルウェア修正 |
| 2026-07-15 | トップ制作物 最新10件。カード列のみ全幅（見出しは max-w-content） |
| 2026-07-15 | works/events 正方形カード（上画像・下説明）。説明は text-sm・ellipsis・下余白 |
| 2026-07-15 | 画像: sharp で AVIF/WebP（`.tmp` のみ）。`<picture>`。ファイル名 → works 共有（events も同じ） |
| 2026-07-16 | events の image も public/images/works/ から取得。`public/images/events/` フォルダ廃止 |
| 2026-07-15 | カードフォールバック画像 = `header.jpg`。ヒーローも `<picture>`（image-set 廃止） |
| 2026-07-15 | Vite が画像を assets に二重出力しないよう `/images/` + closeBundle 正規化 |
| 2026-07-15 | ヒーロー解像度はソース側で管理（960×480 に置換）。ビルド側の強制縮小はしない |
| 2026-07-15 | Person JSON-LD を `src/data/person.json` に共通化。description / givenName / familyName / gender / nationality / knowsAbout / ImageObject 等 |
| 2026-07-15 | 本ドキュメントに上記を集約して更新 |
