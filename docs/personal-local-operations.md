# MOPRO Personal local operations

Date: 2026-08-30 (JST)

## Purpose

MOPRO Personal runs the Cloudflare OS fork as a local AI operating environment. Interactive
authoring uses the owner's Codex subscription through a loopback bridge; paid API fallback is not
allowed. Existing Gadgets can keep operating without an AI call unless their implementation
explicitly invokes a model.

## Start the environment

Run the services from the repository root. Local state under `.wrangler/` and connected-account
configuration are preserved across restarts.

```sh
pnpm mopro:doctor
pnpm mopro:start
```

`pnpm codex-bridge` runs a local health supervisor. It checks the ChatGPT-subscription bridge
every five seconds and restarts it if it exits or becomes unhealthy. It never falls back to an
API-key model.

Open `http://localhost:3000`. The Router remains on `127.0.0.1:8787`, and the Codex bridge listens
only on `127.0.0.1:8788`. The canonical ownership and lifecycle of all local ports is maintained in
`docs/personal-port-registry.md`.

Start the core environment together with the standard local MCP services when they are needed:

```sh
pnpm mopro:start -- --with-local-mcp
```

| Port | Service | Notes |
| --- | --- | --- |
| 3000 | MOPRO frontend | Canonical Personal UI; strict port |
| 3002 | Multica frontend | Docker companion UI |
| 8080 | Multica backend / Desktop daemon | Desktop profile `desktop-127.0.0.1-8080` |
| 8787 | MOPRO Router | Workshop backend, Gatekeepers and local ChatGPT MCP Worker |
| 8788 | Codex subscription bridge | Local authoring only; no paid API fallback |
| 8790 | Chatwork MCP | Reads plus approval-gated actions |
| 8791 | Mattermost MCP | OAuth connection to the configured Mattermost deployment |
| 8792 | Multica MCP | Uses the Multica Desktop daemon at `127.0.0.1:8080` |
| 8793 | Local video MCP | FFmpeg, ImageMagick, and macOS `say`; zero API cost |
| 8794 | ChatGPT MCP tunnel boundary | Optional; start explicitly only when required |

Do not start a second Homebrew Multica daemon while Multica Desktop is running.

## Product roles

- `builder`: default for normal users. Can create workspaces, connect Gatekeepers, use Context &
  Skills, manage Blueprints, and inspect Outputs.
- `operator`: configured through the deployment `OPERATORS` list. Can open only shared workspaces
  with `use` access and cannot author or configure the environment.
- `admin`: remains a builder and retains deployment administration access.

The local development configuration currently lists `moprooperatortest` as an Operator test user.

## Agent catalog

Explore contains 25 Japanese products grouped into eight job families: management, sales,
marketing, customer support, commerce, project management, engineering/IT, and people/operations.
Selecting **このエージェントを構築** seeds the implementation contract and carries the Japanese
product name into the workspace at first submission.

Catalog entries are implementation starters, not prebuilt executables. The authoring agent still
creates and tests the Gadget. Required Gatekeepers must be introduced both to the authoring chat
when it needs to inspect a tool and to the Gadget when its persistent code must call that tool.

## Context & Skills

Context documents are not Markdown-only. Markdown, plain text, JSON, and other text-oriented
documents can be stored and retrieved. PDF content should be extracted to searchable text when
reliable grounding is required; binary PDF rendering is not itself a Context document.

A Skill is a folder containing `SKILL.md` with instructions and optional supporting files. The demo
collection `MOPRO AI OS デモガイド` contains:

- `README.md` — user-facing explanation of Context and Skills;
- `product-facts.json` — structured product facts;
- `skills/product-brief/SKILL.md` — a runnable product-brief Skill example.

The distributable shared baseline lives in `context-collections/mopro-core-skills/`. Import it as a
Context collection to give agents evidence-first research, approval-safe execution, backward
planning, and observable quality gates. Keep specialist Skills in agent-specific collections so
the shared catalog remains small and avoids unrelated activations. See `docs/mopro-core-skills.md`
for adoption and review rules.

## Local video rendering

Start `pnpm local-video-mcp`, then connect `http://127.0.0.1:8793/mcp` as an MCP Server. For an
agent-built video Gadget, introduce the same MCP account to the authoring chat for tool discovery
and bind it to the Gadget for persistent execution.

The renderer provides:

- `local_video_capabilities`;
- `render_vertical_video`;
- `get_video_render_status`;
- `list_local_video_projects`.

Outputs are written under `.local-video/projects/` and intentionally ignored by Git. Rendering
produces H.264/AAC MP4 at 1080x1920, local narration, caption-card scenes, project metadata, and a
rights manifest. A render is an approval-gated action. The renderer never publishes the result.

Practical constraints:

- each input scene must be 1–20 seconds; callers should split longer scenes;
- the Japanese `Kyoko` system voice must be installed;
- browser preview uses the artifact URL returned by the renderer, not the filesystem path;
- a job is complete only after status reaches `completed`; metadata alone is not a video result.

## kintone

The kintone Gatekeeper connects one app per account using an app-scoped API token. It restricts
origins to `https://*.cybozu.com`, validates the app ID and token during setup, audits every read,
and queues record creation, updates, comments, and process transitions for approval.

## Local state and backup

Use the existing Personal backup commands before risky upgrades:

```sh
pnpm personal:backup
pnpm personal:backup:verify -- <archive>
pnpm personal:restore -- <archive> <empty-target-directory>
```

Backups, `.wrangler/`, `.dev.vars*`, and rendered videos are never committed.

## Current boundaries

- Subscription inference is local-only; AWS or another hosted runtime cannot reach loopback.
- Tailscale can expose the Workshop UI to the owner's devices, but WebSocket routing and companion
  services must remain reachable for chat and connected tools to work.
- MCP writes remain approval-gated unless a vetted portal explicitly trusts tool annotations.
- Agent catalog quality depends on the generated Gadget and the connections introduced to it;
  catalog presence alone does not prove end-to-end operation.
