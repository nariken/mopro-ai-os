# Pilot Success Agent

Pilot Success Agent is the Business Operator job for preparing, running, and
evaluating a 30-day paid pilot. The current implementation is a synthetic-only
personal operations MVP in MOPRO AI OS.

## Canonical references

- Notion: [Pilot Success Agent Job 01 | 30-day Pilot Control Tower v0.2](https://app.notion.com/p/3cb50ed0e509813b9017fb7f74cc4611)
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

The implementation self-check returned `passed: true`.

## Daily operation

1. Open the `Pilot Success Agent | 30-day Pilot` workspace from Favorites.
2. Read the Daily Pilot Brief and confirm its evidence references.
3. Work the highest-priority item outside the Gadget as appropriate.
4. Select the new state, confirm the actor, and enter a concrete reason.
5. Apply the update and confirm metrics, overdue count, and brief changed.
6. Review internal synthetic approvals and approve or return with a reason.
7. Use the Activity Log as the audit trail for the day's operation.

Do not enter real customer data or use the UI to imply that a proposal,
contract, invoice, or customer communication has occurred.

## Remaining before a real pilot

- define and approve the exact customer scope and success metrics;
- add a pre-connection safety gate and customer data classification;
- implement Weekly Pilot Review;
- implement the Day 30 Outcome Package;
- add revision-safe approval for customer-facing drafts;
- measure human operating time and agent/API cost; and
- export a sanitized Blueprint that contains no customer data or credentials.
