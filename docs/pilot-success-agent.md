# Pilot Success Agent

Pilot Success Agent is the Business Operator job for preparing, running, and
evaluating a 30-day paid pilot. The current implementation is a synthetic-only
personal operations MVP in MOPRO AI OS.

## Canonical references

- Notion: [Pilot Success Agent Job 01 | 30-day Pilot Control Tower v1.0](https://app.notion.com/p/3cb50ed0e509813b9017fb7f74cc4611)
- Local workspace: `7ac897d5d2e9f5960d703ef1c38d4d85e1a3d418fcb7e0f6857bec89022a7f22`
- Gadget: `Pilot Success Control Tower`

The Notion page is the product and operating specification. This document is
the repository handoff for implementation scope, validation, and daily use.

## Implemented scope

The Control Tower persists one synthetic pilot and presents:

- pilot overview and safety boundary;
- success metrics with evidence;
- ten work items, including overdue and approval-waiting states;
- issues and risks;
- a maximum of three evidence-linked Daily Pilot Brief actions;
- revisioned Weekly Pilot Review drafts for a selected continuous seven-day period;
- revisioned Day 30 Outcome Packages with evidence-linked recommendations;
- internal synthetic approval decisions; and
- an activity log for every accepted state change.

An operator can change a work item between `not started`, `in progress`,
`blocked`, `approval waiting`, and `complete`. The server validates allowed
transitions and rejects missing actors, missing reasons, no-op updates, and
invalid transitions. Approval decisions are limited to approve or return for
revision from the waiting state.

Every accepted change records the actor, timestamp, prior value, new value,
and reason. Success metrics, overdue counts, approval counts, and the Daily
Pilot Brief are recalculated from persisted state after a change.

The Weekly Pilot Review aggregates Activity Log, Synthetic Operation Log,
work items, issues and risks, and approvals. It reports the start and end
state, processed count, completion rate, overdue items, approval decisions,
blockers, rework, Human Touch, agent/API cost, evidence references, next-week
improvements, and scope-change candidates. Missing measurements are shown as
`not measured`; they are never estimated. Regenerating the same period creates
a new revision while preserving the earlier draft.

The Day 30 Outcome Package summarizes the pilot period, Before/After state,
metric targets and actuals, outcomes, constraints, incidents, Human operating
time, agent/API cost, reusable settings and runbooks, and an internal
continue/revise/stop recommendation. It also produces a continuation-proposal
draft. Every result is linked to Synthetic Evidence, every generation is
recorded in the Activity Log, and prior revisions are preserved. The package
cannot make or execute a commercial decision.

## Safety boundary

This MVP has no external connection and uses synthetic data only. It cannot:

- send anything to a customer;
- connect to customer or production data;
- execute or modify a contract;
- issue an invoice;
- update an external system; or
- grant authority through an internal approval decision.

Any future external action must be implemented as a separate capability and
must require Human Approval before execution. The Sportsland-equivalent pilot
is unproposed, unsigned, confidential, and not suitable for publication.

## Validation record

Validation completed on 2026-08-29 (Asia/Tokyo):

- baseline: 1 pilot, 10 work items, 2 overdue, 1 approval waiting, 3 brief actions;
- completing `W-01` recalculated completion from 10% to 20% and overdue from 2 to 1;
- returning `A-01` for revision recalculated approval waiting from 1 to 0 and
  moved `W-03` to blocked;
- both actions produced complete activity-log records; and
- the synthetic dataset was reset to its baseline after validation.

Weekly Review validation used seven synthetic Operation Logs for 2026-08-23
through 2026-08-29. Revisions 1 and 2 were both preserved and reported:

- 7 processed items and a 14% completion rate;
- evidence references for the reported results;
- Human Touch, agent/API cost, approval decisions, and rework as `not measured`;
  and
- no mutation of the operational baseline: 10 work items, `W-01` in progress,
  and `A-01` waiting for approval.

The implementation self-check returned `passed: true`.

Day 30 validation used 30 Synthetic Daily Evidence records. Revisions 1 through
3 were generated and preserved. The latest package reported:

- 60 processed items, 57 on time, and 3 rework events;
- 360 Human operating minutes and 1.95 Synthetic cost units;
- completion 90%, on-time processing 95%, rework 5%, and evidence coverage 100%;
- two evidence-linked synthetic incidents with no external action;
- an internal `revise` recommendation, not an executed continuation decision;
  and
- evidence references from `E-D01` through `E-D30`.

Revision 3 removed a decision-basis inconsistency by deriving metric judgments
and recommendation evidence from the same comparison results. On-time
processing at 95% now consistently satisfies the target of 95% or higher. The
internal `revise` recommendation remains based on the absence of real-pilot
evidence, not on a synthetic metric failure.

The Day 30 self-check returned `passed: true`. Weekly Review revisions 1 and 2,
all ten work items, `W-01` in progress, and `A-01` waiting for approval remained
unchanged.

## Daily operation

1. Open the `Pilot Success Agent | 30-day Pilot` workspace from Favorites.
2. Read the Daily Pilot Brief and confirm its evidence references.
3. Work the highest-priority item outside the Gadget as appropriate.
4. Select the new state, confirm the actor, and enter a concrete reason.
5. Apply the update and confirm metrics, overdue count, and brief changed.
6. Review internal synthetic approvals and approve or return with a reason.
7. Use the Activity Log as the audit trail for the day's operation.

Once a week, select a continuous seven-day period, generate the Weekly Pilot
Review, verify every result against its evidence references, and record the
next-week improvements. Regenerate only when a corrected internal draft is
needed; the new revision does not replace its predecessors.

At the end of the synthetic pilot, generate the Day 30 Outcome Package, verify
the metric calculations and every Evidence reference, then review the internal
recommendation and continuation-proposal draft. A new generation creates a new
revision and does not replace the prior package.

Do not enter real customer data or use the UI to imply that a proposal,
contract, invoice, or customer communication has occurred.

## Remaining before a real pilot

- define and approve the exact customer scope and success metrics;
- add a pre-connection safety gate and customer data classification;
- add revision-safe approval for customer-facing drafts;
- validate Human operating time and agent/API cost measurement with real-pilot
  data after the safety gate; and
- export a sanitized Blueprint that contains no customer data or credentials.
