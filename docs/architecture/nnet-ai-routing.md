# ADR: Personal and Nnet AI routing

Date: 2026-08-26
Status: Accepted for Nnet planning

## Context

Personal currently sends Codex Subscription inference to a companion bridge at
`127.0.0.1:8788`. The bridge uses the owner's Codex login, while the Workshop
fails closed instead of silently falling back to a paid API.

OpenAI documents ChatGPT sign-in as the subscription route and API-key sign-in
as usage-based access. Codex CLI can also authenticate on a headless machine,
but its cached login is a credential that must be isolated like a password.

References:

- [OpenAI authentication](https://developers.openai.com/codex/auth)
- [Codex CLI](https://developers.openai.com/codex/cli)

## Decision

Separate the authoring plane from the deployed runtime plane.

### Personal

- Run Workshop and the Codex companion locally.
- Use the owner's ChatGPT/Codex subscription for interactive Gadget creation.
- Do not fall back from subscription to a paid API without an explicit setting.

### Nnet

- Treat a packaged, versioned `.gadget` as the deployment boundary.
- Build or modify Gadgets in the owner's local authoring plane, then import the
  verified package into Nnet.
- Run imported Gadgets without generative AI unless that Gadget explicitly has
  an approved AI capability.
- Use managed API inference only for browser-based creation or modification
  that must execute entirely inside the hosted Nnet environment.

## Why

An AWS-hosted service cannot reach a user's loopback companion. A public or
reverse-tunneled companion is possible, and Codex can technically authenticate
on a headless host, but a multi-user product would then need per-user credential
isolation, routing, revocation, availability, entitlement, and audit controls.
That turns a simple inference route into a security-sensitive identity system.

The authoring/runtime split keeps zero-to-one Gadget construction on the
subscription route without making the Nnet runtime depend on the owner's
machine or pooling one person's subscription across customers.

## Explicit non-goals for the first Nnet milestone

- No shared server-side ChatGPT subscription credential.
- No automatic subscription-to-API fallback.
- No internet-exposed `8788` bridge.
- No per-user remote Codex credential broker.
- No AI requirement for ordinary execution of an already-built Gadget.

## Future option

If hosted interactive construction becomes a product requirement, introduce a
separate builder service using a managed API budget, or design a per-user local
companion relay as its own reviewed security project. Do not add both routes to
the first Nnet milestone.
