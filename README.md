# about-ogatomo

[ogtm.dev](https://ogtm.dev) — 小川 智也（Tomoya Ogawa）のポートフォリオサイト。

## 概要

- **Vite 6** + **Tailwind CSS v3** による静的サイト
- Works / Links などは `src/data/*.json` で管理し、**ビルド時に HTML へ埋め込み**（実行時 CMS/API なし）
- 日英対応（`src/i18n/`）。ページ内の言語切替はリロードなし
- `main` への push で Cloudflare Pages がテストと本番ビルドを実行し、`dist/` を配信

## 開発

要件: Node.js 20.9 以上

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # dist/ に静的成果物を出力
npm run ci       # テスト + 本番ビルド + 成果物検査
npm run preview  # ビルド結果の確認
```

### コンテンツの更新

| 内容 | 編集先 |
|------|--------|
| 制作物 | `src/data/works.json` |
| リンク | `src/data/links.json` |
| スキル | `src/data/skills.json` |
| 経歴 | `src/data/career.json` |
| イベント・受賞 | `src/data/events.json` |
| UI 文言（日英） | `src/i18n/ja.json` / `en.json` |
| レイアウト | `src/index.html` |
| スタイル | `src/css/main.css` / Tailwind クラス |

変更後は `npm run test` と `npm run build`（または `dev`）で反映を確認してください。

## ライセンス

MIT — Tomoya Ogawa

詳細なエージェント向けドキュメントは [AGENTS.md](./AGENTS.md) を参照。

## 短縮リンク・管理画面

公開ドメインは `https://ogtm.dev`。静的ページを優先してPages Functionsで短縮リンクを解決します。管理画面は非公開リポジトリ `ogatomo21/about-ogatomo-admin` へ分離。運用手順は非公開の管理リポジトリで管理します。
