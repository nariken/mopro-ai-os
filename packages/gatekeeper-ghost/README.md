# Ghost Draft Gatekeeper

Ghost Admin APIへの権限をMOPRO AI OSのCapabilityとして限定公開し、AgentがGhost記事の下書きを安全に作成・更新するためのGatekeeperです。

## 状態

2026-08-29時点でPersonal MVPのE2E確認が完了しています。

- 公開済み記事を下書き検索から除外
- 下書きの作成
- 下書きの取得とslug検索
- Human Approval後の下書き更新
- `updated_at` による楽観的排他制御
- 古いリビジョンを承認要求前にAgentへ即時返却
- 承認待ち中に発生した競合を適用時に再確認

## 安全境界

このGatekeeperが提供するのは下書き操作だけです。

- 可能: 下書きの取得、検索、作成、更新、feature imageの添付、タグ・SEOメタデータの設定
- 不可: 公開、予約公開、メール配信、削除、公開済み記事の更新、サイト共通設定の変更
- 書き込みはすべてApproval Queueを通過し、Human Approval後にのみ適用
- 接続したGhost Admin API keyはGatekeeperのUserAccount Durable Object内に保持し、Gadgetへ渡さない
- Workspace共有時の観測はowner-only

## Agent API

Workspaceでは通常 `GHOST_DRAFTS` として接続されます。

```ts
interface GhostDraftSession {
  findDraftBySlug(slug: string): Promise<GhostDraftSnapshot | null>;
  getDraft(id: string): Promise<GhostDraftSnapshot | null>;
  createDraft(content: GhostDraftContent, featureImage?: GhostDraftImage): Promise<void>;
  updateDraft(
    id: string,
    expectedUpdatedAt: string,
    content: GhostDraftContent,
    featureImage?: GhostDraftImage,
  ): Promise<void>;
}
```

更新は、直前の `getDraft()` または `findDraftBySlug()` が返した `updatedAt` を必須とします。競合時は最新版を再取得し、意図した変更をマージしてから新しい更新を提案します。

## 接続

1. Ghost AdminでCustom Integrationを作成する
2. MOPRO AI OSのConnectionsからGhostを選ぶ
3. Publication URLとAdmin API keyを入力する
4. WorkspaceへGhost Publication capabilityを追加する

接続時にGhost Admin APIへの疎通を検証します。Publication URLは公開HTTPS originのみ受け付けます。

## E2E evidence

nariken.aiのテスト下書きで次を確認済みです。

1. 公開済みslugの検索が `null` を返す
2. Agentが下書き作成を提案し、承認後にGhostへ保存される
3. 最新の `updatedAt` を使う更新が承認後に保存される
4. 古い `updatedAt` を使う更新は承認要求を作らず即時拒否される
5. 競合拒否後もGhost本文とDraft状態が変化しない

テスト用Ghost post IDや認証情報は、このドキュメントとリポジトリには保存しません。

## 検証

```sh
pnpm --filter @gadgets/ghost-gatekeeper test:run
pnpm exec vp run -F @gadgets/ghost-gatekeeper build
```

現在の単体テストは、リビジョン一致時の通過と、古いリビジョンに対する再取得・マージ指示を検証します。

## 次の範囲

公開操作は意図的に未実装です。将来追加する場合も、Draft capabilityとは分離し、公開専用の明示的なHuman Approvalと公開後QAを別Operationとして設計します。
