import { createLogger } from "@gadgets/backend-utils/logger";
import type { GhostDraftContent, GhostDraftImage, GhostDraftSnapshot } from "./types";

type GhostLogFields = { event?: string; status?: number; operation?: string; vendorId?: string };
const logger = createLogger<GhostLogFields>({ component: "gatekeeper.ghost", vendorId: "ghost" });

export interface GhostCredentials { baseUrl: string; adminApiKey: string }

interface GhostPost {
  id: string; title: string; slug: string; status: string; updated_at: string;
  url?: string; feature_image?: string | null; feature_image_alt?: string | null;
  tags?: Array<{ name?: string } | string>;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }

async function makeToken(key: string): Promise<string> {
  const [id, secret, extra] = key.split(":");
  if (!id || !secret || extra || !/^[0-9a-f]+$/i.test(secret) || secret.length % 2 !== 0) {
    throw new Error("Invalid Ghost Admin API key.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(utf8(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id })));
  const payload = base64Url(utf8(JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" })));
  const secretBytes = Uint8Array.from(secret.match(/../g) ?? [], value => Number.parseInt(value, 16));
  const cryptoKey = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, utf8(`${header}.${payload}`)));
  return `${header}.${payload}.${base64Url(signature)}`;
}

export function normalizeGhostBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Ghost publication URL must be a public HTTPS origin without credentials or a custom port.");
  }
  return url.origin;
}

export class GhostApi {
  constructor(private readonly credentials: GhostCredentials) {}

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await makeToken(this.credentials.adminApiKey);
    const response = await fetch(`${this.credentials.baseUrl}/ghost/api/admin${path}`, {
      ...init,
      redirect: "manual",
      headers: { Authorization: `Ghost ${token}`, "Accept-Version": "v6.0", ...init.headers },
    });
    if (!response.ok) {
      logger.warn("Ghost Admin API request failed", { event: "admin_api.request.failed", status: response.status });
      throw new Error(`Ghost Admin API request failed (${response.status}).`);
    }
    return response.json();
  }

  async verify(): Promise<void> { await this.#request("/site/"); }

  async getDraft(id: string): Promise<GhostDraftSnapshot | null> {
    const result = await this.#request(`/posts/${encodeURIComponent(id)}/?include=tags`) as { posts?: GhostPost[] };
    return this.#draft(result.posts?.[0]);
  }

  async findDraftBySlug(slug: string): Promise<GhostDraftSnapshot | null> {
    const result = await this.#request(`/posts/slug/${encodeURIComponent(slug)}/?include=tags`) as { posts?: GhostPost[] };
    return this.#draft(result.posts?.[0]);
  }

  async createDraft(content: GhostDraftContent, image?: GhostDraftImage): Promise<void> {
    const featureImage = image ? await this.#uploadImage(image) : undefined;
    await this.#request("/posts/?source=html", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts: [{ ...this.#content(content), feature_image: featureImage, status: "draft" }] }),
    });
  }

  async updateDraft(id: string, expectedUpdatedAt: string, content: GhostDraftContent, image?: GhostDraftImage): Promise<void> {
    const current = await this.requireCurrentDraft(id, expectedUpdatedAt);
    const featureImage = image ? await this.#uploadImage(image) : current.featureImageUrl;
    await this.#request(`/posts/${encodeURIComponent(id)}/?source=html&save_revision=true`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts: [{ ...this.#content(content), feature_image: featureImage, status: "draft", updated_at: expectedUpdatedAt }] }),
    });
  }

  async requireCurrentDraft(id: string, expectedUpdatedAt: string): Promise<GhostDraftSnapshot> {
    const current = await this.getDraft(id);
    if (!current) {
      throw new Error("Ghost draft no longer exists as a draft. Fetch the latest post state before proposing another update.");
    }
    if (current.updatedAt !== expectedUpdatedAt) {
      throw new Error("Ghost draft changed since it was read. Fetch the latest draft, merge the intended changes, and propose a new update.");
    }
    return current;
  }

  #content(content: GhostDraftContent): Record<string, unknown> {
    return {
      title: content.title, html: content.html, slug: content.slug, custom_excerpt: content.excerpt,
      meta_title: content.metaTitle, meta_description: content.metaDescription,
      feature_image_alt: content.featureImageAlt, tags: content.tags,
    };
  }

  async #uploadImage(image: GhostDraftImage): Promise<string> {
    const form = new FormData();
    form.set("file", image.file, image.filename); form.set("purpose", "image"); form.set("ref", image.filename);
    const result = await this.#request("/images/upload/", { method: "POST", body: form }) as { images?: Array<{ url?: string }> };
    const url = result.images?.[0]?.url;
    if (!url) throw new Error("Ghost did not return an uploaded image URL.");
    return url;
  }

  #draft(post?: GhostPost): GhostDraftSnapshot | null {
    if (!post || post.status !== "draft") return null;
    return {
      id: post.id, title: post.title, slug: post.slug, status: "draft", updatedAt: post.updated_at,
      previewUrl: post.url, featureImageUrl: post.feature_image ?? undefined,
      featureImageAlt: post.feature_image_alt ?? undefined,
      tags: (post.tags ?? []).map(tag => typeof tag === "string" ? tag : tag.name).filter((tag): tag is string => Boolean(tag)),
    };
  }
}
