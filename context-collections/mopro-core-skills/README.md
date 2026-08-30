# MOPRO Core Skills

MOPRO AI OS の全エージェントで共用する、低権限・業種非依存の標準 Skill 集です。

このコレクションは、公開 Skill の人気順をそのまま取り込むのではなく、MOPRO の実行境界に合わせて再設計しています。外部通信、認証情報の利用、公開、送信、課金、削除は Skill 自体が許可せず、実行時の明示的な権限と承認に従います。

初期セット:

- `evidence-first-research`: 根拠と推測を分離した調査
- `approval-safe-execution`: 書込み・公開・送信を安全に実行
- `goal-backward-planning`: 目標から逆算した計画とKPI
- `quality-gate`: 成果物の受入条件と検証

専門 Skill はこの共通層へ混ぜず、SEO、広告、営業、コンテンツなど各エージェントのコレクションへ追加します。
