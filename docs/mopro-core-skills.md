# MOPRO Core Skills

MOPRO AI OS の標準 Skill は、公開ランキングの一括導入ではなく、共通層と専門層に分けて管理する。

## 初期共通層

配布正本は `context-collections/mopro-core-skills/` に置く。

- `evidence-first-research`: 根拠、推測、未確認事項の分離
- `approval-safe-execution`: 外部書込みの準備、承認、重複防止、証跡
- `goal-backward-planning`: 目標、先行指標、施策、停止条件の逆算
- `quality-gate`: 受入条件に基づく完成判定

## 採用基準

公開 Skill は次の条件をすべて満たす場合だけ、MOPRO向けにレビューまたは移植する。

1. 出所とライセンスを確認できる。
2. 指示本文と参照ファイルを全てレビューできる。
3. 認証情報の探索、無断API利用、外部送信、自己更新を要求しない。
4. 書込み、公開、課金、削除を承認なしで実行しない。
5. MOPROで利用可能なCapabilityだけを前提とする。
6. 実タスクの受入条件で、Skillなしの場合より改善を確認できる。

ダウンロード数、スター数、ランキング順位は候補抽出にのみ使い、品質判定には使わない。

## 運用

共通 Skill は自動選択可能な少数に保つ。SEO、AEO、MEO、広告、営業、コンテンツなどの専門 Skill は対象エージェントのContextコレクションに限定する。月次で利用回数、成功率、手戻り、誤発火を確認し、改善効果のない Skill は無効化する。

## 2026-08-29 導入・実地検証

- PersonalのContext & SkillsへPrivate Collection `MOPRO Core Skills`を作成した。
- 4つの`SKILL.md`がすべて `Contains a valid Agent Skill` と認識され、Documentsは4件になった。
- WorkspaceのSlash Command Pickerへ4コマンドが表示されることを確認した。
- 広告戦略オペレーターで`/goal-backward-planning`を実行した。
- 実行条件は「2026年9月営業開始、30日Pilotを1社5万円で3社、広告費上限1万円、過去取引先2社を優先、3社目は低コストInbound」とした。
- 結果は、目標、前提、指標Tree、週次施策、成功基準、判定日、計算根拠、停止・修正条件を含み、外部広告API、出稿、課金を実行範囲外に維持した。
- Skill原本のContext Observationと読取りがAudit表示され、Codex Subscription経路で完了した。有料APIは使用していない。

### 判定

初期4Skillは **Demo可能**。ただしSkillなしの対照実行、複数Agentでの誤発火率、月次の手戻り削減は未計測のため、実運用検証済みとはしない。

## 正本とトレーサビリティ

- Notion正本：`CF OSベース AI OS｜確定要件・Personal MVP v1.0`（Page ID `3c850ed0-e509-810c-82ef-c50340083914`）
- Agent設計正本：`AI OS Gadget構成・顧客価値仮説｜設計ベース v0.1`（Page ID `3c950ed0-e509-8119-919b-ed4ff1357166`）
- Repository正本：`context-collections/mopro-core-skills/`
- 運用文書：`docs/personal-local-operations.md`
- 検証文書：本ファイル

Notionには判断と成熟度を、GitHubには再配布可能なSkill本文と検証記録を保持する。両者の更新日は2026-08-29（JST）。
