# MOPRO AI OS ブログ記事作成セッション向け確認ガイド

## まず確認するもの

1. **完成した60秒デモ動画**
   - `demo-video/output/mopro-ai-os-internal-demo-v1.mp4`
   - 60秒、1280×720、日本語ナレーション・字幕付き。
   - 実際のローカル環境の画面を使用している。

2. **最終ナレーションとショット構成**
   - `demo-video/script.md`
   - 音声用の発音指定版: `demo-video/narration.txt`
   - ElevenLabs v3音声: `demo-video/output/narration-elevenlabs-v3.mp3`

3. **Mattermostの先行告知文**
   - `demo-video/mattermost-announcement.md`
   - 実際の投稿: `https://mm-nnet.nnetworks.co.jp:1443/nnetworks/pl/yf79sj3jw7yifkd7zc1ykfru8a`
   - 投稿先は `Off-Topic`。`@channel` とデモ動画添付あり。
   - 主旨は「リリース済み」ではなく「近日社内リリース予定」。

## 製品の事実確認

### 全体像・設計思想

- `README.md`
  - Gadgets、AIエージェント、Blueprint、Gatekeeper、サンドボックスの考え方。
  - 通常の生成AIとの違いを説明する一次資料。

### MOPRO Personalの現在の実装範囲

- `docs/personal-local-operations.md`
  - ローカル構成、Codex Subscription、MCPサービス、利用ロール。
  - エージェントカタログ、Context & Skills、ローカル動画レンダラー、kintone。
  - 現時点の制約と承認境界。

### エージェントカタログ

- 実画面: `http://localhost:8787/explore`
- 画面キャプチャ:
  - `demo-video/captures/02-explore.png`
  - `demo-video/captures/03-catalog-marketing.png`
- 確認できる事実:
  - 8つの業務領域。
  - 25種類の日本語エージェント商品。
  - 「このエージェントを構築」から実装契約を引き継いで開始する。
  - カタログ項目は完成済み実行物ではなく、実装スターター。

### 実際に動いたエージェント／Gadget

- ワークスペース名: `トレンド動画制作オペレーター`
- 実画面キャプチャ:
  - `demo-video/captures/05-workspace.png`
  - `demo-video/captures/06-connections.png`
- ローカル生成物:
  - `.local-video/projects/2026-08-27-mopro-ai-os-b861f30e/`
- 確認できる流れ:
  - テーマ入力。
  - 台本・字幕・絵コンテ・素材権利の整理。
  - ローカルナレーションとMP4レンダリング。
  - 制作進捗と品質チェック。
  - 素材権利、プラン、最終プレビューの承認。
  - 自動公開はしない。

### Context & Skills

- 実画面: `http://localhost:8787/gatekeepers/context`
- キャプチャ: `demo-video/captures/07-context-skills.png`
- デモコレクション: `MOPRO AI OS デモガイド`
- 確認ポイント:
  - Contextはエージェントが参照する業務情報。
  - Skillは `SKILL.md` と任意の補助ファイルで構成する実行手順。
  - Markdown限定ではなく、JSONやプレーンテキストも扱う。

### 安全性・外部システム接続

- `README.md` のGatekeeper／sandbox節。
- `docs/personal-local-operations.md` の承認境界。
- 記事で扱える要点:
  - エージェントとGadgetは初期状態で外部アクセス権を持たない。
  - 接続先は明示的に導入・バインドする。
  - 外部への書き込みは承認対象。
  - 動画生成はローカルで完了し、自動公開しない。

## 今回の検証から記事にできる流れ

1. ローカル環境でエージェントの実運用を検証。
2. 25種類のカタログから動画制作エージェントを選択。
3. 専用Gadgetを構築し、動画制作工程を実装。
4. ローカルレンダラーで実MP4を生成。
5. 1分の製品デモを実画面から制作。
6. ElevenLabs v3で日本語ナレーションを調整。
7. Mattermostで社内リリース予定を先行告知。

ブログでは、単なる機能紹介よりも「エージェントが業務用アプリを作り、そのアプリが次の制作業務を完了し、社内告知までつながった」という実運用の連鎖を中心にするとよい。

## 表現上の注意

- MOPRO AI OSは**まだ社内リリース前**。リリース済みと書かない。
- 「25種類すべてが完成済み・検証済み」とは書かない。カタログは実装スターター。
- 実運用で確認できた代表例は「トレンド動画制作オペレーター」。
- 自律実行を過大表現しない。外部送信・更新・公開には人の確認がある。
- ローカルのURL、OAuth情報、トークン、`.dev.vars`、接続先の秘密情報は記事へ載せない。
- Mattermost投稿は社内限定。外部記事へスクリーンショットや投稿本文を転載する場合は公開範囲を確認する。

## 専用セッションへの依頼文例

> `demo-video/blog-session-handoff.md` を入口に、記載された一次資料と完成動画を確認してください。MOPRO AI OSがまだ社内リリース前であること、25種類のカタログは実装スターターであること、人の承認境界があることを守りつつ、今回の実運用検証からMattermost先行告知までを題材にブログ記事化できるか評価してください。記事化できる場合は、想定読者、記事の主題、構成案、不足情報、公開前に確認すべき事項を提示してください。まだ本文は公開・投稿しないでください。
