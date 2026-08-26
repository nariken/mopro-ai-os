# MOP-564 M2 — Codex subscription Context evidence

Date: 2026-08-26 (JST)

## Scope

Live verification of grounded and unanswerable responses through the loopback-only Codex
subscription bridge. The test used synthetic data, performed no external writes, and supplied no
credentials to the model request.

Bridge health response:

```json
{"ok":true,"mode":"chatgpt-subscription"}
```

Model: `gpt-5.6-sol`

## Grounded answer

Synthetic Context:

```text
[source:policy-quote-validity]
見積書の有効期限は提出日から7日間です。期限を過ぎた見積は営業責任者の再承認が必要です。
```

Question: `見積の有効期限と、期限後に必要な対応を答えてください。`

Observed answer:

```text
見積書の有効期限は提出日から7日間です。[policy-quote-validity]
期限を過ぎた見積は、営業責任者の再承認が必要です。[policy-quote-validity]
```

Result: PASS. Each factual statement is supported by and cites the supplied source.

## Unsupported question

The same Context was used to ask: `社員の年間有給休暇日数を答えてください。`

Observed answer:

```text
回答不能: 提供されたContextに根拠がありません。
```

Result: PASS. The model did not invent an answer or use outside knowledge.

## Workshop Context gatekeeper E2E

A private collection named `MOP-564 Sample Policy` was created in the local Context management UI
with the synthetic `quote-policy.md` fixture. Existing collections were not modified.

The Workshop home screen showed `Codex Subscription (GPT 5.6 Sol)` as the selected model. In a new
chat, the grounded prompt produced the following observable path:

1. The agent inspected the ambient `CONTEXT` binding and discovered one matching resource.
2. It searched the Context Library for `MOP-564 Sample Policy` and resolved the document ID.
3. It read the complete target document through the Context observation path.
4. It returned both required facts with Source ID `policy-quote-validity` attached to each fact.

The follow-up unsupported question returned:

```text
回答不能です。指定された「MOP-564 Sample Policy」には、社員の年間有給休暇日数に
関する記載・根拠がありません。推測は行いません。
```

Result: PASS. This closes the previously identified UI/RPC discovery-and-read residual gap.

## Constraints

- Both the direct bridge check and the live Workshop Context discovery/read path used synthetic
  local data and performed no external writes.
- Token usage and cost are reported as zero by the experimental bridge because the Codex CLI does
  not expose per-turn accounting through this integration. Execution identity is instead proven by
  the bridge health mode and the dedicated `codex-subscription` routing tests.
