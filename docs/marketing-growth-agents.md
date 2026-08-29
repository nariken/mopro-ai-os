# Marketing growth agents

This document records the Personal environment's revenue-linked marketing agents. These agents
separate observations from assumptions and keep every external publication or paid action behind
Human Approval.

## Search Growth Strategist

Status: Demo-capable and accepted in the Personal workspace on 2026-08-29.

The Search Growth Strategist works backward from a 90-day revenue target to required orders,
opportunities, qualified inquiries, and organic sessions. It combines SEO, AEO, and legitimate
MEO into one operating plan. Its current Gadget includes:

- Day 1–7 baseline audit with observed, estimated, and unavailable classifications;
- Google Search Console, Analytics, Business Profile, Ghost, and Notion connection audit;
- a 90-day plan, weekly priorities, facts and hypotheses, approvals, and measurement decisions;
- three scored briefs for handoff to the Content Operator;
- continue, improve, and stop rules linked to qualified inquiries and opportunity conversion.

Google Business Profile work is excluded until a legitimate location or service area is confirmed.
Publishing, profile changes, review replies, external distribution, and paid spend require approval.

## Advertising Strategy Operator

Status: Demo-capable and accepted in the Personal workspace on 2026-08-29.

The Advertising Strategy Operator selects a paid-acquisition platform for the business type,
target occupation, offer, geography, economics, buying cycle, and available creative. It distinguishes
advertiser platforms from publisher monetization: Google AdSense earns revenue from a publisher's
site and is not treated as a customer-acquisition media-buying platform.

### Required inputs

- offer, audience, geography, average order value or LTV, gross margin, and sales cycle;
- delivery capacity, target CTA, landing page, evidence, and creative constraints;
- budget ceiling, conversion events, existing baselines, and measurement readiness.

### Outputs

- platform-fit score and exclusion reasons for Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads,
  Microsoft Ads, and other currently available advertising surfaces;
- pessimistic, base, and optimistic forecasts for impressions, clicks, CTA, qualified CTA,
  opportunities, sales, revenue, gross profit, CAC, and payback;
- formulas, assumptions, break-even sensitivity, campaign structure, exclusions, UTM conventions,
  conversion events, creative variants, and landing-page alignment;
- controlled continue, change, stop, and scale recommendations based on measured results.

Forecasts are ranges, not guarantees. Account connection, audience upload, creative publication,
campaign launch, spend, budget changes, and pausing live campaigns require Human Approval. Each
approved action must include a diff, expected result, downside, rollback, and idempotency key.

The Synthetic MVP was verified with a B2B SaaS example. It scored five media platforms, selected
LinkedIn Ads and Google Ads as the primary candidates, generated pessimistic/base/optimistic
forecasts through payback, created platform-specific creative and campaign drafts, and registered
a non-executing approval card. All eight views rendered successfully; no advertising account,
external API, audience upload, campaign launch, or paid action was used.

## Platform safety additions

- Proposed Gadget JavaScript is parsed immediately before acceptance; malformed code cannot reach
  mainline and the user sees the Gadget, file, line, and column.
- The local ChatGPT Subscription bridge is health-checked every five seconds and restarted when
  unavailable. It never falls back to an API-key model.
