# MOPRO Personal port registry

This file is the canonical port and process registry for the local MOPRO AI OS environment. Do not
assign an unlisted service to these ports or rely on Vite's automatic next-port fallback.

| Port | Process owner | Service | Lifecycle |
| ---: | --- | --- | --- |
| 3000 | MOPRO | Workshop frontend (Vite) | Core; started by `pnpm mopro:start` |
| 3002 | Multica Docker | Multica self-host frontend | External companion; Docker Compose |
| 8080 | Multica Desktop / Docker | Multica backend and Desktop daemon profile | External companion; Desktop-managed |
| 8787 | MOPRO | Workshop Router, backend, Gatekeepers and ChatGPT MCP Worker | Core; started by `pnpm mopro:start` |
| 8788 | MOPRO | Codex ChatGPT-subscription bridge supervisor | Core; started by `pnpm mopro:start` |
| 8790 | MOPRO | Chatwork MCP | Optional local MCP |
| 8791 | MOPRO | Mattermost MCP | Optional local MCP |
| 8792 | MOPRO | Multica MCP adapter | Optional local MCP; upstream is port 8080 |
| 8793 | MOPRO | Local video MCP | Optional local MCP; no paid API |
| 8794 | MOPRO | ChatGPT MCP tunnel boundary | Optional; explicitly started |

## Commands

```sh
pnpm mopro:doctor
pnpm mopro:start
pnpm mopro:start -- --with-local-mcp
```

`mopro:start` reuses a running core process only when its HTTP fingerprint matches the expected
MOPRO service. A different service on 3000, 8787, or 8788 is a hard failure. The frontend uses
Vite's `--strictPort`, so it never silently moves away from 3000.

The default command starts only the three core MOPRO processes. `--with-local-mcp` also starts
Chatwork, Mattermost, Multica, and local-video MCP services. It does not start or restart Multica
Desktop, the Multica Docker stack, or the Homebrew daemon. The Desktop daemon must use profile
`desktop-127.0.0.1-8080`; never start the Homebrew daemon while it is running.

## Change control

1. Change `scripts/personal-ports.ts` first.
2. Update this table and any companion application's environment at the same time.
3. Run `pnpm mopro:doctor` and `node --test scripts/personal-ports.test.ts`.
4. For a Multica frontend-port change, update `/Users/kennarita/multica-selfhost/.env`, recreate only
   the affected Docker services, and verify the Desktop daemon remains on port 8080.
5. Do not expose ports 8788 or 8790–8794 beyond loopback.
