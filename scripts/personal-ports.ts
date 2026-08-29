/** Canonical loopback services used by MOPRO Personal and its local companions. */
export const PERSONAL_SERVICES = [
  { id: "mopro-frontend", owner: "MOPRO", port: 3000, tier: "core", url: "http://127.0.0.1:3000/" },
  { id: "multica-frontend", owner: "Multica", port: 3002, tier: "external", url: "http://127.0.0.1:3002/" },
  { id: "multica-backend", owner: "Multica Desktop", port: 8080, tier: "external", url: "http://127.0.0.1:8080/" },
  { id: "mopro-router", owner: "MOPRO", port: 8787, tier: "core", url: "http://127.0.0.1:8787/api" },
  { id: "codex-subscription", owner: "MOPRO", port: 8788, tier: "core", url: "http://127.0.0.1:8788/health" },
  { id: "chatwork-mcp", owner: "MOPRO", port: 8790, tier: "optional", url: "http://127.0.0.1:8790/mcp" },
  { id: "mattermost-mcp", owner: "MOPRO", port: 8791, tier: "optional", url: "http://127.0.0.1:8791/mcp" },
  { id: "multica-mcp", owner: "MOPRO", port: 8792, tier: "optional", url: "http://127.0.0.1:8792/mcp" },
  { id: "local-video-mcp", owner: "MOPRO", port: 8793, tier: "optional", url: "http://127.0.0.1:8793/mcp" },
  { id: "chatgpt-mcp-proxy", owner: "MOPRO", port: 8794, tier: "optional", url: "http://127.0.0.1:8794/mcp" },
] as const;

/** One canonical Personal service entry. */
export type PersonalService = (typeof PERSONAL_SERVICES)[number];

/** Return the canonical entry for a service id. */
export function personalService(id: PersonalService["id"]): PersonalService {
  let service = PERSONAL_SERVICES.find(candidate => candidate.id === id);
  if (!service) throw new Error(`Unknown Personal service: ${id}`);
  return service;
}
