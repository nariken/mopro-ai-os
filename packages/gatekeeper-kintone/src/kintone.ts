import { DurableObject, RpcStub, RpcTarget, WorkerEntrypoint } from "cloudflare:workers";
import { validateRpc } from "capnweb-validate";
import { createLogger } from "@gadgets/backend-utils/logger";
import {
  stripTrailingSlashes,
  type ActionDescription,
  type AccountDescription,
  type ApprovalQueue,
  type Gatekeeper,
  type GatekeeperConnectCallback,
  type GatekeeperUser,
  type GatekeeperUserVerifier,
  type GatekeeperVendor as GatekeeperVendorInterface,
  type ResourceConfiguratorFrame,
  type ResourceDescription,
  type SupportedResource,
  type VendorDescription,
} from "@gadgets/workshop-shared/gatekeeper";
import { KintoneApi, KintoneApiError, type KintoneCredentials } from "./kintone-api";
import type { KintoneAppConfiguratorRpc } from "./configurator/kintone-app-configurator-types";
import type {
  KintoneApp,
  KintoneAppMetadata,
  KintoneCommentReference,
  KintoneField,
  KintoneRecord,
  KintoneRecordCursor,
  KintoneRecordReference,
  KintoneQueryOptions,
  KintoneValue,
} from "./types";
import TYPES_CODE from "./types.txt";
import APP_CONFIGURATOR_HTML from "./generated/kintone-app-configurator-ui.txt";

const VENDOR_ID = "kintone";
const NONCE_BYTES = 32;
const NONCE_LIFETIME_MS = 10 * 60 * 1000;
const CONNECT_TIMEOUT_MS = 60 * 60 * 1000;

type KintoneLogFields = {
  vendorId?: string;
  event?: string;
  appId?: string;
  origin?: string;
  status?: number;
  code?: string;
};

const logger = createLogger<KintoneLogFields>({
  component: "gatekeeper.kintone",
  vendorId: VENDOR_ID,
});

type Env = Cloudflare.Env & { BASE_URL?: string };

type StoredNonce = { value: string; expiresAt: number; reconnect: boolean };
type ConnectionResult =
  | { kind: "ok" }
  | { kind: "invalid_nonce" }
  | { kind: "error"; message: string };

const KINTONE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f6feb"/><path fill="white" d="M17 13h9v17l15-17h11L35 31l18 20H41L26 34v17h-9z"/></svg>`;
const KINTONE_ICON = {
  url: `data:image/svg+xml;utf8,${encodeURIComponent(KINTONE_LOGO_SVG)}`,
};

const APP_RESOURCE: SupportedResource = {
  urlPattern: "https://*.cybozu.com/k/:appId/*",
  title: "kintoneアプリ",
  description: "1つのkintoneアプリのフィールドとレコードへアクセスします。",
  icon: KINTONE_ICON,
};

function hexEncode(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function generateNonce(): string {
  return hexEncode(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(aHash, bHash);
}

function getBaseUrl(env: Env): string {
  return stripTrailingSlashes(env.BASE_URL ?? "http://localhost:8787/gatekeeper/kintone");
}

function getBasePath(env: Env): string {
  const path = new URL(getBaseUrl(env)).pathname;
  return path === "/" ? "" : path;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function normalizeOrigin(input: string): string {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/") {
    throw new Error("https://サブドメイン.cybozu.com の形式で入力してください。");
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(".cybozu.com") || hostname === ".cybozu.com") {
    throw new Error("cybozu.comのサブドメインだけ接続できます。");
  }
  return `https://${hostname}`;
}

function credentialsFromResourceUrl(urlString: string, stored: KintoneCredentials): KintoneCredentials {
  const url = new URL(urlString);
  const match = url.pathname.match(/^\/k\/(\d+)\/?$/);
  if (url.origin !== stored.origin || !match || match[1] !== stored.appId) {
    throw new Error("この接続で許可されたkintoneアプリではありません。");
  }
  return stored;
}

const connectForm = (actionUrl: string, error?: string) => `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>kintone接続</title><style>
body{font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;min-height:100vh;display:grid;place-items:center}.card{background:#fff;padding:2rem;max-width:560px;width:calc(100% - 3rem);border-radius:12px;box-shadow:0 3px 16px #0002}h1{margin-top:0;color:#1f6feb;font-size:1.5rem}label{display:block;font-weight:650;margin-top:1rem;margin-bottom:.3rem}input{box-sizing:border-box;width:100%;padding:.65rem;border:1px solid #bbb;border-radius:6px;font-size:1rem}.hint{font-size:.84rem;color:#666;margin-top:.3rem}.error{background:#fee2e2;color:#991b1b;padding:.75rem;border-radius:6px}button{margin-top:1.5rem;padding:.7rem 1.5rem;border:0;border-radius:6px;background:#1f6feb;color:#fff;font-size:1rem;cursor:pointer}ol{padding-left:1.4rem;line-height:1.7}</style></head>
<body><main class="card"><h1>kintoneを接続</h1><p>接続するアプリの情報と、そのアプリで発行したAPIトークンを入力してください。</p>
${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
<form method="POST" action="${escapeHtml(actionUrl)}">
<label for="origin">kintone URL</label><input id="origin" name="origin" type="url" required placeholder="https://example.cybozu.com" autofocus><div class="hint">アプリのURLではなく、環境の先頭URLを入力します。</div>
<label for="appId">アプリID</label><input id="appId" name="appId" inputmode="numeric" pattern="[0-9]+" required placeholder="123"><div class="hint">アプリURLの /k/ に続く数字です。</div>
<label for="apiToken">APIトークン</label><input id="apiToken" name="apiToken" type="password" required autocomplete="off"><div class="hint">kintoneのアプリ設定 → APIトークンで発行し、必要な権限を付与してください。</div>
<button type="submit">接続を確認</button></form></main></body></html>`;

const INVALID_LINK_HTML = "<!DOCTYPE html><html lang=\"ja\"><meta charset=\"UTF-8\"><body><h2>接続リンクの有効期限が切れています</h2><p>CF OSへ戻り、もう一度接続してください。</p></body></html>";
const COMPLETE_HTML = "<!DOCTYPE html><html lang=\"ja\"><meta charset=\"UTF-8\"><body><script>window.close()</script><h2>kintoneを接続しました</h2><p>この画面を閉じてCF OSへ戻ってください。</p></body></html>";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const basePath = getBasePath(env);
    if (!url.pathname.startsWith(`${basePath}/`) && url.pathname !== basePath) {
      return new Response("Not Found", { status: 404 });
    }
    const path = url.pathname.slice(basePath.length + 1).split("/");
    if (path.length !== 2 || !/^[0-9a-f]{64}$/.test(path[0]) || !/^[0-9a-f]{64}$/.test(path[1])) {
      return new Response("Not Found", { status: 404 });
    }
    const account = ctx.exports.UserAccount.get(ctx.exports.UserAccount.idFromString(path[0]));
    const nonce = path[1];
    if (request.method === "GET") {
      if (!(await account.verifyNonce(nonce))) {
        return new Response(INVALID_LINK_HTML, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return new Response(connectForm(request.url), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const form = await request.formData();
    let credentials: KintoneCredentials;
    try {
      const appId = String(form.get("appId") ?? "").trim();
      if (!/^\d+$/.test(appId)) throw new Error("アプリIDは数字で入力してください。");
      const apiToken = String(form.get("apiToken") ?? "").trim();
      if (!apiToken) throw new Error("APIトークンを入力してください。");
      credentials = { origin: normalizeOrigin(String(form.get("origin") ?? "").trim()), appId, apiToken };
    } catch (error) {
      const message = error instanceof Error ? error.message : "入力内容を確認してください。";
      return new Response(connectForm(request.url, message), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    const result = await account.completeConnection(nonce, credentials);
    if (result.kind === "invalid_nonce") {
      return new Response(INVALID_LINK_HTML, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (result.kind === "error") {
      return new Response(connectForm(request.url, result.message), { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new Response(COMPLETE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
} satisfies ExportedHandler<Env>;

@validateRpc()
export class GatekeeperVendor extends WorkerEntrypoint<Env> implements GatekeeperVendorInterface {
  async describe(): Promise<VendorDescription> {
    return {
      displayName: "kintone",
      url: "https://kintone.cybozu.co.jp/",
      logo: KINTONE_ICON,
      color: "#eaf2ff",
      tagline: "kintoneアプリのデータをAIエージェントから安全に利用します。",
      description: "アプリ単位のAPIトークンで、フィールドとレコードを読み取り、業務操作を準備します。",
    };
  }

  async connectAccount(callback: Fetcher<GatekeeperConnectCallback>): Promise<{ url: string }> {
    const id = this.ctx.exports.UserAccount.newUniqueId();
    const nonce = generateNonce();
    await this.ctx.exports.UserAccount.get(id).setCallback(callback, nonce);
    return { url: `${getBaseUrl(this.env)}/${id}/${nonce}` };
  }

  async getSupportedResources(): Promise<SupportedResource[]> {
    return [APP_RESOURCE];
  }

  async getTypeScriptTypes(): Promise<string> {
    return TYPES_CODE;
  }
}

export class UserAccount extends DurableObject<Env> {
  async setCallback(callback: Fetcher<GatekeeperConnectCallback>, nonce: string): Promise<void> {
    if (!this.ctx.storage.kv.get<KintoneCredentials>("credentials")) {
      await this.ctx.storage.setAlarm(Date.now() + CONNECT_TIMEOUT_MS);
    }
    this.ctx.storage.kv.put("callback", callback);
    this.ctx.storage.kv.put<StoredNonce>("nonce", {
      value: nonce,
      expiresAt: Date.now() + NONCE_LIFETIME_MS,
      reconnect: false,
    });
  }

  async prepareReconnect(nonce: string): Promise<void> {
    this.ctx.storage.kv.put<StoredNonce>("nonce", {
      value: nonce,
      expiresAt: Date.now() + NONCE_LIFETIME_MS,
      reconnect: true,
    });
  }

  async verifyNonce(nonce: string): Promise<boolean> {
    const stored = this.ctx.storage.kv.get<StoredNonce>("nonce");
    return Boolean(stored && Date.now() < stored.expiresAt && await constantTimeEqual(stored.value, nonce));
  }

  async completeConnection(nonce: string, credentials: KintoneCredentials): Promise<ConnectionResult> {
    if (!(await this.verifyNonce(nonce))) return { kind: "invalid_nonce" };
    const reconnect = this.ctx.storage.kv.get<StoredNonce>("nonce")?.reconnect === true;
    let app: KintoneAppMetadata;
    try {
      app = await new KintoneApi(credentials).getApp();
    } catch (error) {
      logger.warn("connection validation failed", {
        event: "connection.validation.failed",
        appId: credentials.appId,
        origin: credentials.origin,
        status: error instanceof KintoneApiError ? error.status : undefined,
        code: error instanceof KintoneApiError ? error.code : undefined,
      });
      const message = error instanceof KintoneApiError
        ? `kintone接続に失敗しました: ${error.message}`
        : "kintoneへ接続できませんでした。URL、アプリID、APIトークンを確認してください。";
      return { kind: "error", message };
    }
    const callback = this.ctx.storage.kv.get<Fetcher<GatekeeperConnectCallback>>("callback");
    if (!callback) return { kind: "error", message: "接続処理の有効期限が切れました。" };
    this.ctx.storage.kv.delete("nonce");
    this.ctx.storage.kv.delete("credentialsExpired");
    this.ctx.storage.kv.put("credentials", credentials);
    this.ctx.storage.kv.put("app", app);
    try {
      if (reconnect) {
        await callback.credentialsRestored();
      } else {
        await callback.complete(this.ctx.exports.KintoneUser({ props: { userObjectId: this.ctx.id.toString() } }));
      }
    } catch (error) {
      this.ctx.storage.kv.delete("credentials");
      this.ctx.storage.kv.delete("app");
      return { kind: "error", message: error instanceof Error ? error.message : "CF OSへの接続登録に失敗しました。" };
    }
    await this.ctx.storage.deleteAlarm();
    return { kind: "ok" };
  }

  getCredentials(): KintoneCredentials {
    const credentials = this.ctx.storage.kv.get<KintoneCredentials>("credentials");
    if (!credentials) throw new Error("kintoneの認証情報がありません。");
    return credentials;
  }

  getApp(): KintoneAppMetadata {
    const app = this.ctx.storage.kv.get<KintoneAppMetadata>("app");
    if (!app) throw new Error("kintoneアプリ情報がありません。");
    return app;
  }

  async alarm(): Promise<void> {
    if (!this.ctx.storage.kv.get<KintoneCredentials>("credentials")) await this.ctx.storage.deleteAll();
  }

  async revoke(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async noteCredentialsExpired(): Promise<void> {
    if (this.ctx.storage.kv.get<boolean>("credentialsExpired")) return;
    this.ctx.storage.kv.put("credentialsExpired", true);
    const callback = this.ctx.storage.kv.get<Fetcher<GatekeeperConnectCallback>>("callback");
    if (callback) await callback.credentialsExpired();
  }
}

type KintoneUserProps = { userObjectId: string };

interface KintoneVerifierApi extends GatekeeperUserVerifier {
  hasAppAccess(origin: string, appId: string): Promise<boolean>;
}

@validateRpc()
export class KintoneUser extends WorkerEntrypoint<Env, KintoneUserProps> implements GatekeeperUser {
  #account() {
    return this.ctx.exports.UserAccount.get(this.ctx.exports.UserAccount.idFromString(this.ctx.props.userObjectId));
  }

  async describe(): Promise<AccountDescription> {
    const app = await this.#account().getApp();
    return { displayName: `kintone: ${app.name}`, uniqueName: app.url, avatar: KINTONE_ICON };
  }

  async getSupportedResources(): Promise<SupportedResource[]> {
    return [APP_RESOURCE];
  }

  async getAuthenticatedEmail(): Promise<string | null> { return null; }

  async reconnect(): Promise<{ url: string }> {
    const nonce = generateNonce();
    await this.#account().prepareReconnect(nonce);
    return { url: `${getBaseUrl(this.env)}/${this.ctx.props.userObjectId}/${nonce}` };
  }

  async startResourceConfigurator(resourceUrlPattern: string): Promise<ResourceConfiguratorFrame> {
    if (resourceUrlPattern !== APP_RESOURCE.urlPattern) throw new Error("未対応のkintoneリソースです。");
    const app = await this.#account().getApp();
    return { iframeHtml: APP_CONFIGURATOR_HTML, ui: new RpcStub(new KintoneAppConfigurator(app)) };
  }

  async getGatekeeperClassFor(url: string): Promise<{ class: DurableObjectClass<Gatekeeper<KintoneApp>>; resource: SupportedResource }> {
    const credentials = credentialsFromResourceUrl(url, await this.#account().getCredentials());
    return {
      class: this.ctx.exports.KintoneGatekeeper({ props: { userObjectId: this.ctx.props.userObjectId, origin: credentials.origin, appId: credentials.appId } }),
      resource: APP_RESOURCE,
    };
  }

  async revoke(): Promise<void> {
    await this.#account().revoke();
  }

  async ensureResources(resourceUrlPatterns: string[]): Promise<{ url?: string }> {
    if (resourceUrlPatterns.some(pattern => pattern !== APP_RESOURCE.urlPattern)) {
      throw new Error("未対応のkintoneリソースが要求されました。");
    }
    return {};
  }

  async getVerifier(): Promise<Fetcher<GatekeeperUserVerifier>> {
    return this.ctx.exports.KintoneVerifier({ props: { userObjectId: this.ctx.props.userObjectId } });
  }
}

@validateRpc()
class KintoneAppConfigurator extends RpcTarget implements KintoneAppConfiguratorRpc {
  constructor(private readonly app: KintoneAppMetadata) { super(); }

  async listApps(): Promise<{ value: string; title: string; subtitle: string }[]> {
    return [{ value: this.app.url, title: this.app.name, subtitle: `App ID: ${this.app.appId}` }];
  }
}

@validateRpc()
export class KintoneVerifier extends WorkerEntrypoint<Env, KintoneUserProps> implements KintoneVerifierApi {
  async hasAppAccess(origin: string, appId: string): Promise<boolean> {
    const account = this.ctx.exports.UserAccount.get(
      this.ctx.exports.UserAccount.idFromString(this.ctx.props.userObjectId),
    );
    const credentials = await account.getCredentials();
    if (credentials.origin !== origin || credentials.appId !== appId) return false;
    try {
      await new KintoneApi(credentials).getApp();
      return true;
    } catch (error) {
      if (error instanceof KintoneApiError && error.isAccessError) return false;
      throw error;
    }
  }
}

type KintoneGatekeeperProps = { userObjectId: string; origin: string; appId: string };

type KintoneAction =
  | { id: number; type: "createRecord"; fields: Record<string, KintoneValue>; provisionalId: string }
  | { id: number; type: "updateRecord"; recordId: string; fields: Record<string, KintoneValue>; revision?: string }
  | { id: number; type: "addComment"; recordId: string; text: string }
  | { id: number; type: "transitionStatus"; recordId: string; action: string; assignee?: string; revision?: string };

type KintoneActionInput = KintoneAction extends infer Action
  ? Action extends { id: number } ? Omit<Action, "id"> : never
  : never;

type StoredAction = { action: KintoneAction; submittedAt: number };
type CacheEntry<T> = { value: T; expiresAt: number };

const APP_CACHE_MS = 5 * 60 * 1000;
const RECORD_CACHE_MS = 30 * 1000;

function summarizeFields(fields: Record<string, KintoneValue>): string {
  const entries = Object.entries(fields);
  const preview = entries.slice(0, 20).map(([code, value]) => `- **${code}**: \`${JSON.stringify(value)}\``).join("\n");
  return entries.length > 20 ? `${preview}\n- …ほか${entries.length - 20}フィールド` : preview;
}

function validateFields(fields: Record<string, KintoneValue>): void {
  const count = Object.keys(fields).length;
  if (count === 0 || count > 100) throw new Error("fields must contain between 1 and 100 fields.");
  if (JSON.stringify(fields).length > 100_000) throw new Error("fields payload is too large.");
}

function validateRecordId(recordId: string): void {
  if (!/^\d+$/.test(recordId) && !/^~[0-9a-f-]{36}$/.test(recordId)) {
    throw new Error("recordId must be numeric or a provisional record ID.");
  }
}

@validateRpc()
export class KintoneGatekeeper extends DurableObject<Env, KintoneGatekeeperProps> implements Gatekeeper<KintoneApp> {
  #account() {
    return this.ctx.exports.UserAccount.get(this.ctx.exports.UserAccount.idFromString(this.ctx.props.userObjectId));
  }

  async describe(): Promise<ResourceDescription> {
    const app = await this.#account().getApp();
    return { url: app.url, title: app.name, snippet: `kintone App ID: ${app.appId}`, suggestedBindingName: "KINTONE_APP", tsType: "KintoneApp" };
  }

  async getTypeScriptTypes(): Promise<string> { return TYPES_CODE; }

  async getAutoApprovableActions() { return []; }

  #nextActionId(): number {
    const id = this.ctx.storage.kv.get<number>("nextActionId") ?? 1;
    this.ctx.storage.kv.put("nextActionId", id + 1);
    return id;
  }

  #actionKey(id: number): string { return `action:${id}`; }

  #pendingActions(): KintoneAction[] {
    return [...this.ctx.storage.kv.list<StoredAction>({ prefix: "action:" })]
      .map(([, stored]) => stored)
      .toSorted((a, b) => a.submittedAt - b.submittedAt)
      .map(stored => stored.action);
  }

  #resolveRecordId(recordId: string): string | undefined {
    if (!recordId.startsWith("~")) return recordId;
    return this.ctx.storage.kv.get<string>(`resolved:${recordId}`);
  }

  #invalidateRecordCache(recordId?: string): void {
    if (recordId) this.ctx.storage.kv.delete(`cache:record:${recordId}`);
    this.ctx.storage.kv.delete("cache:query");
  }

  async #api(): Promise<KintoneApi> {
    return new KintoneApi(await this.#account().getCredentials());
  }

  async #withApi<T>(operation: (api: KintoneApi) => Promise<T>): Promise<T> {
    try {
      return await operation(await this.#api());
    } catch (error) {
      if (error instanceof KintoneApiError && error.isAccessError) {
        await this.#account().noteCredentialsExpired();
      }
      throw error;
    }
  }

  async getMetadataCached(): Promise<KintoneAppMetadata> {
    const key = "cache:metadata";
    const cached = this.ctx.storage.kv.get<CacheEntry<KintoneAppMetadata>>(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.#withApi(api => api.getApp());
    this.ctx.storage.kv.put(key, { value, expiresAt: Date.now() + APP_CACHE_MS });
    return value;
  }

  async getFieldsCached(): Promise<Record<string, KintoneField>> {
    const key = "cache:fields";
    const cached = this.ctx.storage.kv.get<CacheEntry<Record<string, KintoneField>>>(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.#withApi(api => api.getFields());
    this.ctx.storage.kv.put(key, { value, expiresAt: Date.now() + APP_CACHE_MS });
    return value;
  }

  #overlayRecord(record: KintoneRecord): KintoneRecord {
    let result = record;
    for (const action of this.#pendingActions()) {
      if (action.type === "updateRecord" &&
          (action.recordId === record.id || this.#resolveRecordId(action.recordId) === record.id)) {
        result = { ...result, revision: "~pending", fields: { ...result.fields, ...action.fields } };
      }
    }
    return result;
  }

  async getRecordWithOverlay(recordId: string): Promise<KintoneRecord> {
    if (recordId.startsWith("~")) {
      const create = this.#pendingActions().find(
        (action): action is Extract<KintoneAction, { type: "createRecord" }> =>
          action.type === "createRecord" && action.provisionalId === recordId,
      );
      if (create) return this.#overlayRecord({ id: recordId, revision: "~pending", fields: create.fields });
      const resolved = this.#resolveRecordId(recordId);
      if (!resolved) throw new Error(`Pending kintone record ${recordId} was not found.`);
      recordId = resolved;
    }
    const key = `cache:record:${recordId}`;
    const cached = this.ctx.storage.kv.get<CacheEntry<KintoneRecord>>(key);
    let value: KintoneRecord;
    if (cached && cached.expiresAt > Date.now()) {
      value = cached.value;
    } else {
      value = await this.#withApi(api => api.getRecord(recordId));
      this.ctx.storage.kv.put(key, { value, expiresAt: Date.now() + RECORD_CACHE_MS });
    }
    return this.#overlayRecord(value);
  }

  async queryRecordsWithOverlay(options: { query?: string; fields?: string[]; limit: number; offset: number }): Promise<KintoneRecord[]> {
    return (await this.#withApi(api => api.queryRecords(options))).map(record => this.#overlayRecord(record));
  }

  async submitAction(queue: RpcStub<ApprovalQueue>, action: KintoneActionInput): Promise<KintoneAction> {
    const stored = { ...action, id: this.#nextActionId() } as KintoneAction;
    this.ctx.storage.kv.put<StoredAction>(this.#actionKey(stored.id), { action: stored, submittedAt: Date.now() });
    let description: ActionDescription;
    switch (stored.type) {
      case "createRecord":
        description = { title: "kintoneレコードを登録", description: `新しいレコードを登録します。\n\n${summarizeFields(stored.fields)}`, implementsRevert: false, awaitDecision: true };
        break;
      case "updateRecord":
        description = { title: `kintoneレコード ${stored.recordId} を更新`, description: `次のフィールドを更新します。\n\n${summarizeFields(stored.fields)}`, implementsRevert: false };
        break;
      case "addComment":
        description = { title: `kintoneレコード ${stored.recordId} にコメント`, description: `次のコメントを投稿します。\n\n> ${stored.text.replaceAll("\n", "\n> ")}`, implementsRevert: false, awaitDecision: true };
        break;
      case "transitionStatus":
        description = { title: `kintoneレコード ${stored.recordId} のステータスを変更`, description: `プロセス管理アクション **${stored.action}** を実行します。${stored.assignee ? `\n\n担当者: ${stored.assignee}` : ""}`, implementsRevert: false, awaitDecision: true };
        break;
    }
    try {
      await queue.submitAction(stored.id, description);
    } catch (error) {
      this.ctx.storage.kv.delete(this.#actionKey(stored.id));
      throw error;
    }
    return stored;
  }

  async startSession(approvalQueue: RpcStub<ApprovalQueue>): Promise<KintoneApp> {
    const credentials = await this.#account().getCredentials();
    if (credentials.origin !== this.ctx.props.origin || credentials.appId !== this.ctx.props.appId) {
      throw new Error("kintone接続の対象アプリが一致しません。");
    }
    return new KintoneSession(approvalQueue.dup(), this);
  }

  async applyAction(actionId: number): Promise<void> {
    const stored = this.ctx.storage.kv.get<StoredAction>(this.#actionKey(actionId));
    if (!stored) throw new Error(`Unknown kintone action: ${actionId}`);
    const action = stored.action;
    switch (action.type) {
      case "createRecord": {
        const result = await this.#withApi(api => api.createRecord(action.fields));
        this.ctx.storage.kv.put(`resolved:${action.provisionalId}`, result.id);
        this.#invalidateRecordCache();
        break;
      }
      case "updateRecord": {
        const recordId = this.#resolveRecordId(action.recordId);
        if (!recordId) throw new Error(`Record ${action.recordId} has not been created yet.`);
        await this.#withApi(api => api.updateRecord(recordId, action.fields, action.revision));
        this.#invalidateRecordCache(recordId);
        break;
      }
      case "addComment": {
        const recordId = this.#resolveRecordId(action.recordId);
        if (!recordId) throw new Error(`Record ${action.recordId} has not been created yet.`);
        await this.#withApi(api => api.addComment(recordId, action.text));
        break;
      }
      case "transitionStatus": {
        const recordId = this.#resolveRecordId(action.recordId);
        if (!recordId) throw new Error(`Record ${action.recordId} has not been created yet.`);
        await this.#withApi(api => api.transitionStatus(recordId, action.action, action.assignee, action.revision));
        this.#invalidateRecordCache(recordId);
        break;
      }
    }
    this.ctx.storage.kv.delete(this.#actionKey(actionId));
    logger.info("approved action applied", { event: "action.applied", appId: this.ctx.props.appId, origin: this.ctx.props.origin });
  }

  async rejectAction(actionId: number): Promise<void> {
    this.ctx.storage.kv.delete(this.#actionKey(actionId));
    this.#invalidateRecordCache();
  }
  async revertAction(_actionId: number): Promise<void> { throw new Error("Revert is not implemented."); }

  async addObserver(_id: string, user: Fetcher<GatekeeperUserVerifier>): Promise<void> {
    const verifier = user as Fetcher<KintoneVerifierApi>;
    if (!(await verifier.hasAppAccess(this.ctx.props.origin, this.ctx.props.appId))) {
      throw new Error("この共同利用者は、対象のkintoneアプリへアクセスできません。");
    }
  }

  async removeObserver(_id: string): Promise<void> {}
}

@validateRpc()
class KintoneRecordCursorImpl extends RpcTarget implements KintoneRecordCursor {
  #offset = 0;
  #done = false;
  constructor(
    private readonly gatekeeper: KintoneGatekeeper,
    private readonly approvalQueue: RpcStub<ApprovalQueue>,
    private readonly options: { query?: string; fields?: string[]; batchSize: number },
  ) { super(); }

  async next(): Promise<KintoneRecord[] | null> {
    if (this.#done) return null;
    const records = await this.gatekeeper.queryRecordsWithOverlay({ ...this.options, limit: this.options.batchSize, offset: this.#offset });
    await this.approvalQueue.authorizeObservation({ title: "kintoneレコードを検索", description: `${records.length}件のレコードを取得しました。` });
    this.#offset += records.length;
    if (records.length < this.options.batchSize) this.#done = true;
    return records.length === 0 ? null : records;
  }

  [Symbol.dispose](): void { this.approvalQueue[Symbol.dispose](); }
}

@validateRpc()
class KintoneSession extends RpcTarget implements KintoneApp {
  constructor(private readonly approvalQueue: RpcStub<ApprovalQueue>, private readonly gatekeeper: KintoneGatekeeper) { super(); }

  [Symbol.dispose](): void { this.approvalQueue[Symbol.dispose](); }

  async getMetadata(): Promise<KintoneAppMetadata> {
    const app = await this.gatekeeper.getMetadataCached();
    await this.approvalQueue.authorizeObservation({ title: "kintoneアプリ情報を取得", description: `${app.name}の基本情報を取得しました。` });
    return app;
  }

  async getFields(): Promise<Record<string, KintoneField>> {
    const fields = await this.gatekeeper.getFieldsCached();
    await this.approvalQueue.authorizeObservation({ title: "kintoneフィールドを取得", description: `${Object.keys(fields).length}件のフィールド設定を取得しました。` });
    return fields;
  }

  async queryRecords(options: KintoneQueryOptions = {}): Promise<KintoneRecordCursor> {
    const batchSize = Math.max(1, Math.min(500, Math.trunc(options.batchSize ?? 100)));
    return new KintoneRecordCursorImpl(this.gatekeeper, this.approvalQueue.dup(), { query: options.query, fields: options.fields, batchSize });
  }

  async getRecord(recordId: string): Promise<KintoneRecord> {
    const record = await this.gatekeeper.getRecordWithOverlay(recordId);
    await this.approvalQueue.authorizeObservation({ title: "kintoneレコードを取得", description: `レコードID ${record.id}を取得しました。` });
    return record;
  }

  async createRecord(fields: Record<string, KintoneValue>): Promise<KintoneRecordReference> {
    validateFields(fields);
    const provisionalId = `~${crypto.randomUUID()}`;
    await this.gatekeeper.submitAction(this.approvalQueue, { type: "createRecord", fields, provisionalId });
    return { id: provisionalId, revision: "~pending" };
  }

  async updateRecord(recordId: string, fields: Record<string, KintoneValue>, revision?: string): Promise<KintoneRecordReference> {
    validateRecordId(recordId);
    validateFields(fields);
    await this.gatekeeper.submitAction(this.approvalQueue, { type: "updateRecord", recordId, fields, revision });
    return { id: recordId, revision: "~pending" };
  }

  async addComment(recordId: string, text: string): Promise<KintoneCommentReference> {
    validateRecordId(recordId);
    if (!text.trim() || text.length > 10_000) throw new Error("comment must contain 1 to 10,000 characters.");
    const action = await this.gatekeeper.submitAction(this.approvalQueue, { type: "addComment", recordId, text });
    return { commentId: `~${action.id}` };
  }

  async transitionStatus(recordId: string, action: string, assignee?: string, revision?: string): Promise<void> {
    validateRecordId(recordId);
    if (!action.trim() || action.length > 100) throw new Error("action must contain 1 to 100 characters.");
    if (assignee && assignee.length > 128) throw new Error("assignee is too long.");
    await this.gatekeeper.submitAction(this.approvalQueue, { type: "transitionStatus", recordId, action, assignee, revision });
  }
}
