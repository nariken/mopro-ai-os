# MOP-564 M3 — Representative Gadget evidence

Date: 2026-08-26 (JST)

All Gadgets in this milestone use synthetic local fixtures and must perform no external writes.
The selected model is `Codex Subscription (GPT 5.6 Sol)`.

## 1. 期限超過見積ダッシュボード

Status: PASS

Fixture: [`docs/fixtures/mop-564/quotes.csv`](../fixtures/mop-564/quotes.csv)

Rules:

- Fixed reference date: 2026-08-26
- Include `pending` or `review` quotes submitted more than seven days earlier
- Exclude quotes exactly seven days old
- Sort by elapsed days descending

Observed Preview:

- Rows: `Q-004` (25 days), `Q-001` (16 days), `Q-006` (9 days)
- Count: 3
- Total: JPY 870,000
- Status badges, reference date, filter rule, and `Synthetic Sample` label rendered
- Gadget self-check returned the same three IDs and total
- No external binding, API, notification, approval, or write operation was implemented

## 2. 社内文書検索・根拠付き回答

Status: PASS

Fixture: [`docs/fixtures/mop-564/internal-documents.md`](../fixtures/mop-564/internal-documents.md)

Observed Preview:

- Japanese search UI, four preset questions, answer area, and citation cards rendered
- Initial question `見積の有効期限と期限後の対応は？` answered `7日間` and required sales-manager reapproval before redisplay
- Citation showed `DOC-Q-001`, `見積管理ポリシー`, and the exact supporting excerpt
- Unsupported question `年間有給休暇は何日？` returned `回答不能：Synthetic社内文書に根拠がありません` in the Gadget self-check (`passed: true`)
- `SYNTHETIC SAMPLE` and the no-external-writes notice rendered in Preview
- Search is deterministic and local; no external API, binding, notification, approval, or write operation was implemented

## 3. 予算実績 CSV分析

Status: PASS

Fixture: [`docs/fixtures/mop-564/budget-actual.csv`](../fixtures/mop-564/budget-actual.csv)

Observed Preview:

- Embedded CSV loaded as six rows and the initial self-check passed all seven expected assertions
- Budget total: JPY 3,000,000; actual total: JPY 3,340,000; variance: +JPY 340,000
- Three over-budget records rendered in descending variance order: `S-005` (+JPY 210,000), `S-001` (+JPY 120,000), `S-003` (+JPY 90,000)
- Department aggregation rendered with Development (`開発`) as the largest over-budget department at +JPY 170,000
- UI states that the fixture is synthetic, amounts are JPY, input CSV is not externally transmitted, and no external writes occur
- Empty rows are accepted; missing required columns, invalid numeric values, and column-count mismatches produce Japanese validation errors
- Analysis is deterministic and local; no external API, binding, notification, approval, or write operation was implemented

## M3 result

Status: PASS — all three representative Gadgets were created with `Codex Subscription (GPT 5.6 Sol)`, accepted, Preview-verified against synthetic fixtures, and kept free of external writes.
