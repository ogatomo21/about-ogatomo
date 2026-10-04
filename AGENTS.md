# AGENTS.md — about-ogatomo

エージェント／開発者向けの現状整理と編集指針。  
最終更新: 2026-08-31（Cloudflare Pages実設定同期・Clean URL・CI・画像派生改善）

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| 名称 | about-ogatomo |
| 種別 | 個人プロフィール／ポートフォリオ（静的・多言語） |
| 公開 URL | https://ogtm.dev |
| リポジトリ | https://github.com/ogatomo21/about-ogatomo |
| デプロイ | Cloudflare Pages（GitHub連携・自動ビルド） |
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
 scripts/optimize-images.mjs  →  .tmp/images/** に .webp / .avif + SHA-256 manifest
 scripts/inject-data.mjs      →  .tmp/*.html（マーカー埋め込み + i18n + JSON-LD）
        │
        ▼
 Vite（public コピー + HTML を dist/.tmp 経由でビルド）
        │  closeBundle: HTML を dist 直下へ / 画像パス正規化
        │              .tmp/images を dist/images へマージ（public にある同名は上書きしない）
        ▼
      dist/   ← Cloudflare Pages が配信
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
  - `/index.ja` 等のClean URL → `/.tmp/index.ja.html` 等
  - `/index.ja.html` 等（`GENERATED_HTML`）も開発用に `/.tmp/...` へ解決
  - `/images/*.{avif,webp}` で public に無いもの → `.tmp/images` から配信
- **注意:** HTML 内で画像を `./images/foo.avif` のように相対指定すると、Vite が `.tmp` 上の派生を `dist/assets/*.[hash].*` にバンドルし、`dist/images` と **二重になる**。ソースでは **`/images/…`** を使い、`closeBundle` で dist 直下 HTML 向けに `./images/…` / `./assets/…` へ正規化する。

### npm scripts

| コマンド | 内容 |
|----------|------|
| `npm run images` | `public/images` → `.tmp/images` にWebP/AVIF（SHA-256で変更分のみ、`--force`で全再生成） |
| `npm run inject` | JSON → `.tmp/index.*.html` 等 |
| `npm run build` | validate + images + inject + `vite build` → `dist/` + 成果物検査 |
| `npm run ci` | `npm test` + `npm run build`（ローカル / GitHub Actions用） |
| `npm run dev` | Vite（config hookでimages + inject） |
| `npm run preview` | `dist/` をプレビュー |
| `npm run test` | Node標準テスト |
| `npm run validate` | JSON / i18n / 画像参照を検証 |
| `npm run clean` | `dist/` と `.tmp/` を削除 |

画像生成はVite設定のconfig hookで一度だけ行い、`.tmp/image-manifest.json`のSHA-256と生成設定が一致する画像は再利用する。データ注入はVite設定読み込み前に一度だけ行う。ビルド後は`check-build.mjs`で成果物を検査する。

---

## 3. ディレクトリ構成

```
about-ogatomo/
├── package.json            # "type": "module"
├── vite.config.mjs         # inject プラグイン・画像ミドルウェア・dist 平坦化
├── tailwind.config.cjs
├── postcss.config.cjs
├── scripts/
│   ├── inject-data.mjs
│   ├── optimize-images.mjs # sharp → .tmp/images のみ
│   ├── validate-data.mjs
│   └── check-build.mjs
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
│   ├── favicon.ico
│   ├── robots.txt
│   ├── sitemap.xml
│   └── images/
│       # ※ public/CNAME は置かない（Cloudflare Custom Domainで設定）
│       ├── header.jpg      # ヒーロー（現状 960×480・ソースで解像度管理）
│       ├── profile-ogp.png
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
4. 制作物 `#works`（ホームは最新 **10** 件スライダー / 全件の公開URLは `/works.{ja,en}`）
5. イベント・受賞・資格 `#events`（スライダー）
6. リンク集 `#links`
7. CTA / Footer

### スクロールヘッダー / SP メニュー

- 要素: `#site-header` → `.site-header-inner`（**唯一の**すりガラス殻）→ `.site-header-bar` + `.header-menu-body`
- 表示: トップはヒーロー通過後 `is-visible`。ヒーロー無しページは常時表示
- すりガラス: `--glass-*` + 殻 1 枚の `backdrop-filter`。メニューに第 2 ガラス層を付けない
- **PC（md+）**: ブランド + ナビ + 言語 + テーマ。ハンバーガー非表示
- **SP**: ブランド + ハンバーガー。開くと殻が下に伸びる（`max-height`）。`border-radius` は SP で **1.5rem 固定**（開閉アニメ禁止）。言語切替はネイティブの `<select>` を使う

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
- ビルド成果物: `index.ja.html` / `index.en.html`。公開URLは `/index.ja` / `/index.en`（Cloudflare Pages Clean URL）
- ルート `index.html` は保存言語・ブラウザー言語に応じてClean URLへリダイレクト
- `404.html` はリダイレクトしない。Cloudflare Pages が元リクエストURLと404ステータスを保持したまま日本語404を配信し、ページ内切替で英語化する
- 404テンプレートは `<base href="/">` で相対資産URLをルート基準にする。深い不存在URLでもCSS・JS・faviconを読み込めることを成果物検査で確認する。
- 切替: リロードなし（`i18n-runtime.js`）。辞書・data・`content-render` をバンドル（辞書二重持ちは意図的）
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
- 配信成果物は元形式・OGPも含めてEXIF/XMP/IPTCを除去する。`public/images` のソースは変更せず、`dist` のコピーだけを処理する。向き情報は自動回転で画素に反映してから除去し、派生画像にも自動回転を適用する。JPEGの配信用コピーは品質100で再エンコードする。メタデータ残存は成果物検査でビルドを失敗させる。
- カード HTML: `<picture>` で AVIF → WebP → 元ファイル `<img>`。モバイルは `-480` と元解像度の密度候補、PCは元解像度派生を使う
- 実寸より大きい `960w` / `1600w` descriptor は生成しない。OGP画像は元PNGだけを使い派生対象外
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

- デプロイ: Cloudflare PagesのGitHub連携・自動ビルド
- ビルドコマンド: `npm test && npm run build`（未反映コミットでも既存scriptsだけで動く）
- 出力ディレクトリ: `dist`
- 公開ドメイン: **https://ogtm.dev**
- **`public/CNAME` は使わない・作らない。** Custom DomainはCloudflare側で設定する。

### Cloudflare Pages

- このサイトは静的 `dist/` をPagesで配信する。短縮リンクの解決だけPages Functionsで行い、常に静的応答を優先する。
- CF側ビルド: `npm test && npm run build` / 出力 `dist` / Node 20.9以上。`sharp` はビルド時のみ。
- `public/_headers` でCSP等のセキュリティヘッダーとハッシュ付きassetsの長期キャッシュを管理する。
- 公開URLはPagesのClean URLに合わせて拡張子なしとする。生成ファイル名の `.html` は維持する。
- ランタイムのWorkerでViteやCMS/APIを実行しない。
- カスタムドメインはCloudflare側で設定する（リポジトリにCNAMEを置かない）。

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
12. **`public/CNAME` を追加しない**（Cloudflare Custom Domainで設定する）。
13. **公開URLは拡張子なし**（`/index.ja`・`/works.ja` 等）。`.html` は生成ファイル名だけに使う。
14. デプロイ先は **Cloudflare Pages**。明示的な移行指示なしにWorkers Static Assetsへ変更しない。
15. 方針変更はこの AGENTS.md に追記する。

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
| 2026-07-16 | 公開ドメイン about.ogtm.dev。`public/CNAME` 禁止（GHP 用・CF では不要） |
| 2026-07-15 | カードフォールバック画像 = `header.jpg`。ヒーローも `<picture>`（image-set 廃止） |
| 2026-07-15 | Vite が画像を assets に二重出力しないよう `/images/` + closeBundle 正規化 |
| 2026-07-15 | ヒーロー解像度はソース側で管理（960×480 に置換）。ビルド側の強制縮小はしない |
| 2026-07-15 | Person JSON-LD を `src/data/person.json` に共通化。description / givenName / familyName / gender / nationality / knowsAbout / ImageObject 等 |
| 2026-07-15 | 本ドキュメントに上記を集約して更新 |
| 2026-08-10 | Cloudflare PagesのGit連携を整備。データ検証、成果物検査、画像派生のレスポンシブ化、アクセシビリティ改善 |
| 2026-08-10 | 画像派生をSHA-256マニフェストで増分生成。未変更画像の再エンコードを回避 |
| 2026-08-31 | Cloudflare Pages実設定へ文書を同期。Clean URL・404ステータス維持・CI・セキュリティヘッダー・画像派生重複を改善 |
| 2026-09-05 | 過剰設計を整理。言語切替をネイティブselectへ簡素化し、未使用のリンクgroup・互換ラッパーを削除。カード自動スクロールは維持。 |
| 2026-09-08 | 404の資産基準URL、制作物一覧のリンク構造、ダークモードのホバー文字色、スライダーの停止状態を修正。 |
| 2026-09-08 | 配信用画像のEXIF/XMP/IPTC除去と向き補正を追加。元画像・OGPも対象、ソース画像は維持。 |

## 2026-10-03 短縮リンク統合方針

公開ドメインはogtm.dev。短縮リンクだけPages Functions + D1 + Analytics Engine。コンテンツは引き続きGitのJSONから静的生成し、実行時CMS読み込みは導入しない。管理画面は非公開のabout-ogatomo-adminへ分離しAccessで保護する。登録・ビルド公開の両方で静的ルートと短縮IDの衝突を確認する。移行・復旧の運用資料は非公開の管理リポジトリで管理する。

## 2026-10-04 短縮リンク管理への限定

管理画面は短縮リンクとアクセス分析だけを扱う。サイト内容は従来どおりローカルで編集する。下書き・画像アップロード・GitHub編集PRは対象外。適用済みmigrationと既存データは保持し、Git操作と本番切り替えは先行しない。

## 2026-10-04 運用資料の配置

リソース設定・移行・バックアップ・復旧の運用資料は非公開の管理リポジトリに保存し、公開ドキュメントへ追加しない。
