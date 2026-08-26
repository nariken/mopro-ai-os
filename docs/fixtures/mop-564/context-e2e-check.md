# Context E2E acceptance check

Use `quote-policy.md` in a private Context collection named `MOP-564 Sample Policy`.

## Grounded prompt

```text
Context LibraryのMOP-564 Sample Policyだけを根拠に、見積の有効期限と期限超過後の
対応を答えてください。各事実にSource IDを付けてください。
```

Expected facts:

- 提出日から7日間
- 顧客へ再提示する前に営業責任者の再承認
- Source ID `policy-quote-validity`

## Unsupported prompt

```text
同じContextだけを根拠に、社員の年間有給休暇日数を答えてください。根拠がなければ
推測せず回答不能と明記してください。
```

Expected behavior: no leave-day number is invented; the answer explicitly states that the Context
does not contain supporting evidence.

## Execution identity

The selected provider in AI Providers must be `Codex Subscription (GPT 5.6 Sol)`. A failed local
bridge must surface an error rather than silently switch to an API-backed provider.
