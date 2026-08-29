// Secrets and deployment-specific values are intentionally absent from wrangler.jsonc. Wrangler
// generates service-binding types in worker-configuration.d.ts; this augmentation adds only the
// values supplied at deployment time.
interface Env {
  MCP_ACCESS_TOKEN?: string;
  MOPRO_CALLER_EMAIL?: string;
}
