import { DurableObject, RpcStub, RpcTarget, WorkerEntrypoint } from "cloudflare:workers";
import { skipRpcValidation, validateRpc } from "capnweb-validate";
import {
  ApprovalQueue, stripTrailingSlashes, type AccountDescription, type Gatekeeper,
  type GatekeeperConnectCallback, type GatekeeperUser, type GatekeeperUserVerifier,
  type GatekeeperVendor as GatekeeperVendorIface, type ResourceDescription,
  type ResourceConfiguratorFrame, type SupportedResource, type VendorDescription,
} from "@gadgets/workshop-shared/gatekeeper";
import { GhostApi, normalizeGhostBaseUrl, type GhostCredentials } from "./ghost-api";
import type { GhostDraftContent, GhostDraftImage, GhostDraftSession, GhostDraftSnapshot } from "./types";
import type { GhostPublicationConfiguratorRpc } from "./configurator/publication-configurator-types";
import GHOST_PUBLICATION_CONFIGURATOR_HTML from "./generated/publication-configurator-ui.txt";
import TYPES_CODE from "./types.txt";

type Env = Cloudflare.Env & { BASE_URL?: string };
type GatekeeperProps = { userObjectId: string };
type PendingAction =
  | { kind: "create"; content: GhostDraftContent; image?: GhostDraftImage }
  | { kind: "update"; id: string; expectedUpdatedAt: string; content: GhostDraftContent; image?: GhostDraftImage };

const VENDOR_ID = "ghost";
const NONCE_BYTES = 32;
const CONNECT_TIMEOUT_MS = 60 * 60 * 1000;
const GHOST_ICON = { url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%2315171a'/%3E%3Cpath d='M7 9h4v9H7zm7 0h4v14h-4zm7 0h4v9h-4z' fill='white'/%3E%3C/svg%3E" };
const RESOURCE: SupportedResource = {
  urlPattern: "https://*",
  title: "Ghost Publication",
  description: "Create, inspect, and update drafts in one Ghost publication. Publishing and deletion are unavailable.",
  icon: GHOST_ICON,
};

function baseUrl(env: Env): string {
  return stripTrailingSlashes(env.BASE_URL ?? "http://localhost:8787/gatekeeper/ghost");
}
function nonce(): string {
  return [...crypto.getRandomValues(new Uint8Array(NONCE_BYTES))].map(value => value.toString(16).padStart(2, "0")).join("");
}
function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const connectPage = (action: string, error?: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect Ghost</title><style>body{font:16px system-ui;background:#f5f5f5;margin:0;display:grid;place-items:center;min-height:100vh}.card{background:white;padding:2rem;border-radius:12px;max-width:560px;width:calc(100% - 4rem);box-shadow:0 2px 14px #0002}label{display:block;font-weight:600;margin-top:1rem}input{box-sizing:border-box;width:100%;padding:.7rem;margin-top:.3rem}button{margin-top:1.5rem;padding:.7rem 1.2rem;background:#15171a;color:white;border:0;border-radius:6px}.error{color:#b42318;background:#fee4e2;padding:.7rem;border-radius:6px}</style></head><body><main class="card"><h1>Connect Ghost</h1><p>Create a Custom Integration in Ghost Admin, then enter its publication URL and Admin API key. The key stays inside this Gatekeeper.</p>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<form method="post" action="${escapeHtml(action)}"><label>Publication URL<input name="publicationUrl" type="url" required placeholder="https://example.com"></label><label>Admin API key<input name="adminApiKey" type="password" required autocomplete="off"></label><button>Connect and verify</button></form></main></body></html>`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const root = new URL(baseUrl(env)).pathname;
    if (!url.pathname.startsWith(`${root}/`)) return new Response("Not Found", { status: 404 });
    const [id, suppliedNonce] = url.pathname.slice(root.length + 1).split("/");
    if (!id || !suppliedNonce) return new Response("Not Found", { status: 404 });
    const account = ctx.exports.UserAccount.get(ctx.exports.UserAccount.idFromString(id));
    const action = `${baseUrl(env)}/${id}/${suppliedNonce}`;
    if (request.method === "GET") return new Response(connectPage(action), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    const form = await request.formData();
    try {
      await account.finishConnect(suppliedNonce, String(form.get("publicationUrl") ?? ""), String(form.get("adminApiKey") ?? ""));
      return new Response("<!doctype html><script>window.close()</script><p>Ghost connected. You may close this tab.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      return new Response(connectPage(action, message), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
  },
};

@validateRpc()
export class GatekeeperVendor extends WorkerEntrypoint<Env> implements GatekeeperVendorIface {
  async describe(): Promise<VendorDescription> {
    return { displayName: "Ghost", url: "https://ghost.org", logo: GHOST_ICON, color: "#15171A", tagline: "Prepare Ghost drafts safely", description: "Connect a Ghost publication and let agents create or update drafts without granting publish, delete, or site-settings capabilities." };
  }
  async connectAccount(callback: Fetcher<GatekeeperConnectCallback>): Promise<{ url: string }> {
    const id = this.ctx.exports.UserAccount.newUniqueId(); const value = nonce();
    await this.ctx.exports.UserAccount.get(id).prepare(callback, value);
    return { url: `${baseUrl(this.env)}/${id}/${value}` };
  }
  async getSupportedResources(): Promise<SupportedResource[]> { return [RESOURCE]; }
  async getTypeScriptTypes(): Promise<string> { return TYPES_CODE; }
}

export class UserAccount extends DurableObject<Env> {
  async prepare(callback: Fetcher<GatekeeperConnectCallback>, value: string): Promise<void> {
    this.ctx.storage.kv.put("callback", callback); this.ctx.storage.kv.put("nonce", value);
    await this.ctx.storage.setAlarm(Date.now() + CONNECT_TIMEOUT_MS);
  }
  async prepareReconnect(value: string): Promise<void> {
    this.ctx.storage.kv.put("nonce", value); this.ctx.storage.kv.put("reconnecting", true);
    await this.ctx.storage.setAlarm(Date.now() + CONNECT_TIMEOUT_MS);
  }
  async finishConnect(value: string, publicationUrl: string, adminApiKey: string): Promise<void> {
    const expected = this.ctx.storage.kv.get<string>("nonce");
    if (!expected || expected.length !== value.length || !crypto.subtle.timingSafeEqual(new TextEncoder().encode(expected), new TextEncoder().encode(value))) throw new Error("Connection link is invalid or expired.");
    const credentials = { baseUrl: normalizeGhostBaseUrl(publicationUrl), adminApiKey };
    await new GhostApi(credentials).verify();
    const callback = this.ctx.storage.kv.get<Fetcher<GatekeeperConnectCallback>>("callback");
    if (!callback) throw new Error("Connection link expired.");
    this.ctx.storage.kv.put("credentials", credentials); this.ctx.storage.kv.delete("nonce");
    if (this.ctx.storage.kv.get<boolean>("reconnecting")) {
      this.ctx.storage.kv.delete("reconnecting"); await callback.credentialsRestored();
    } else {
      await callback.complete(this.ctx.exports.GatekeeperUserImpl({ props: { userObjectId: this.ctx.id.toString() } }));
    }
    await this.ctx.storage.deleteAlarm();
  }
  async credentials(): Promise<GhostCredentials> {
    const value = this.ctx.storage.kv.get<GhostCredentials>("credentials");
    if (!value) throw new Error("Ghost credentials are not configured."); return value;
  }
  async alarm(): Promise<void> { if (!this.ctx.storage.kv.get("credentials")) await this.ctx.storage.deleteAll(); }
  async revoke(): Promise<void> { await this.ctx.storage.deleteAlarm(); await this.ctx.storage.deleteAll(); }
}

@validateRpc()
export class GatekeeperUserImpl extends WorkerEntrypoint<Env, GatekeeperProps> implements GatekeeperUser {
  #account() { return this.ctx.exports.UserAccount.get(this.ctx.exports.UserAccount.idFromString(this.ctx.props.userObjectId)); }
  async describe(): Promise<AccountDescription> { const c = await this.#account().credentials(); return { displayName: new URL(c.baseUrl).hostname, uniqueName: c.baseUrl, avatar: GHOST_ICON }; }
  async getAuthenticatedEmail(): Promise<null> { return null; }
  async ensureResources(): Promise<{ url?: string }> { return {}; }
  async getSupportedResources(): Promise<SupportedResource[]> { return [RESOURCE]; }
  async getGatekeeperClassFor(): Promise<{ class: DurableObjectClass<Gatekeeper<GhostDraftSession>>; resource: SupportedResource }> { return { class: this.ctx.exports.GhostGatekeeperImpl({ props: { userObjectId: this.ctx.props.userObjectId } }), resource: RESOURCE }; }
  async startResourceConfigurator(resourceUrlPattern: string): Promise<ResourceConfiguratorFrame> {
    if (resourceUrlPattern !== RESOURCE.urlPattern) throw new Error("Unsupported Ghost resource type.");
    const credentials = await this.#account().credentials();
    return { iframeHtml: GHOST_PUBLICATION_CONFIGURATOR_HTML, ui: new RpcStub(new GhostResourceConfigurator(credentials.baseUrl)) };
  }
  async revoke(): Promise<void> { await this.#account().revoke(); }
  async reconnect(): Promise<{ url: string }> { const value = nonce(); await this.#account().prepareReconnect(value); return { url: `${baseUrl(this.env)}/${this.ctx.props.userObjectId}/${value}` }; }
  @skipRpcValidation() async getVerifier(): Promise<Fetcher<GatekeeperUserVerifier>> { return this.ctx.exports.GhostVerifier({}); }
}

@validateRpc()
export class GhostVerifier extends WorkerEntrypoint<Env> implements GatekeeperUserVerifier { verify(): void {} }

class GhostResourceConfigurator extends RpcTarget implements GhostPublicationConfiguratorRpc {
  constructor(private readonly url: string) { super(); }
  async resourceUrl(): Promise<string> { return this.url; }
}

@validateRpc()
export class GhostGatekeeperImpl extends DurableObject<Env, GatekeeperProps> implements Gatekeeper<GhostDraftSession> {
  #account() { return this.ctx.exports.UserAccount.get(this.ctx.exports.UserAccount.idFromString(this.ctx.props.userObjectId)); }
  async describe(): Promise<ResourceDescription> { const c = await this.#account().credentials(); return { url: c.baseUrl, title: `Ghost — ${new URL(c.baseUrl).hostname}`, snippet: "Draft-only post preparation. Publishing, deletion, and site settings are unavailable.", suggestedBindingName: "GHOST_DRAFTS", tsType: "GhostDraftSession" }; }
  async getTypeScriptTypes(): Promise<string> { return TYPES_CODE; }
  async getAutoApprovableActions() { return []; }
  async startSession(queue: RpcStub<ApprovalQueue>): Promise<GhostDraftSession> { return new GhostDraftSessionImpl(this.#account(), queue.dup(), this.ctx.storage.kv); }
  async applyAction(id: number): Promise<void> {
    const pending = this.ctx.storage.kv.get<PendingAction>(`pending:${id}`); if (!pending) throw new Error(`Unknown Ghost action: ${id}`);
    const api = new GhostApi(await this.#account().credentials());
    if (pending.kind === "create") await api.createDraft(pending.content, pending.image);
    else await api.updateDraft(pending.id, pending.expectedUpdatedAt, pending.content, pending.image);
    this.ctx.storage.kv.delete(`pending:${id}`);
  }
  async rejectAction(id: number): Promise<void> { this.ctx.storage.kv.delete(`pending:${id}`); }
  async revertAction(): Promise<{ message: string; canRetry: boolean }> { return { message: "Ghost draft writes are revisioned but are not automatically reverted.", canRetry: false }; }
  async addObserver(): Promise<void> { throw new Error("A Ghost publication binding may only be observed by its owner."); }
  async removeObserver(): Promise<void> {}
}

@validateRpc()
class GhostDraftSessionImpl extends RpcTarget implements GhostDraftSession {
  constructor(private account: DurableObjectStub<UserAccount>, private queue: RpcStub<ApprovalQueue>, private kv: DurableObjectStorage["kv"]) { super(); }
  [Symbol.dispose]() { this.queue[Symbol.dispose](); }
  async #api() { return new GhostApi(await this.account.credentials()); }
  async findDraftBySlug(slug: string): Promise<GhostDraftSnapshot | null> { await this.queue.authorizeObservation({ title: "Read Ghost draft", description: `Find the draft with slug ${slug}.` }); return (await this.#api()).findDraftBySlug(slug); }
  async getDraft(id: string): Promise<GhostDraftSnapshot | null> { await this.queue.authorizeObservation({ title: "Read Ghost draft", description: `Read Ghost draft ${id}.` }); return (await this.#api()).getDraft(id); }
  async createDraft(content: GhostDraftContent, image?: GhostDraftImage): Promise<void> { await this.#submit({ kind: "create", content, image }, `Create Ghost draft “${content.title}”`); }
  async updateDraft(id: string, expectedUpdatedAt: string, content: GhostDraftContent, image?: GhostDraftImage): Promise<void> {
    // Reject a stale proposal before it enters the approval queue, so the agent can read the
    // latest draft and propose a merge instead of leaving the user with a permanently pending
    // action. applyAction() checks the revision again to cover edits made while approval waits.
    await (await this.#api()).requireCurrentDraft(id, expectedUpdatedAt);
    await this.#submit({ kind: "update", id, expectedUpdatedAt, content, image }, `Update Ghost draft “${content.title}”`);
  }
  async #submit(action: PendingAction, title: string): Promise<void> {
    const id = this.kv.get<number>("nextActionId") ?? 1; this.kv.put("nextActionId", id + 1); this.kv.put(`pending:${id}`, action);
    try { await this.queue.submitAction(id, { title, description: "Save content and metadata as a draft. This cannot publish, schedule, email, delete, or change site settings.", implementsRevert: false, awaitDecision: true }); }
    catch (error) { this.kv.delete(`pending:${id}`); throw error; }
  }
}
