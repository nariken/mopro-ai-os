import type { RpcTarget } from "cloudflare:workers";

/** Content and metadata saved to Ghost. The gatekeeper always keeps the post as a draft. */
export interface GhostDraftContent {
  /** Human-readable post title. */
  title: string;
  /** Well-formed HTML. Ghost converts this to its native editor format. */
  html: string;
  /** Optional URL slug. */
  slug?: string;
  /** Optional custom excerpt. */
  excerpt?: string;
  /** Optional search-engine title. */
  metaTitle?: string;
  /** Optional search-engine description. */
  metaDescription?: string;
  /** Alternative text for the feature image. */
  featureImageAlt?: string;
  /** Complete tag list for the draft. */
  tags?: string[];
}

/** Feature image uploaded while saving a draft. */
export interface GhostDraftImage {
  /** Image data. Ghost accepts WEBP, JPEG, GIF, PNG, and SVG feature images. */
  file: Blob;
  /** Original filename, including its extension. */
  filename: string;
}

/** Current state of a Ghost draft. */
export interface GhostDraftSnapshot {
  /** Ghost post identifier. A pending simulated draft uses a `pending:` identifier. */
  id: string;
  title: string;
  slug: string;
  status: "draft";
  /** ISO 8601 collision-detection timestamp required when updating the draft. */
  updatedAt: string;
  /** Ghost preview URL when available. */
  previewUrl?: string;
  featureImageUrl?: string;
  featureImageAlt?: string;
  tags: string[];
}

/** Draft-only access to one connected Ghost publication. */
export interface GhostDraftSession extends RpcTarget {
  /** Find a draft by slug. Published, scheduled, and sent posts are never returned. */
  findDraftBySlug(slug: string): Promise<GhostDraftSnapshot | null>;
  /** Read a draft by Ghost post ID. Published, scheduled, and sent posts are never returned. */
  getDraft(id: string): Promise<GhostDraftSnapshot | null>;
  /** Prepare a new Ghost draft, optionally uploading and attaching its feature image. */
  createDraft(content: GhostDraftContent, featureImage?: GhostDraftImage): Promise<void>;
  /**
   * Replace an existing draft using the timestamp returned by the latest read.
   * If the draft changed, fetch it again, merge the intended changes, and propose a new update.
   */
  updateDraft(
    id: string,
    expectedUpdatedAt: string,
    content: GhostDraftContent,
    featureImage?: GhostDraftImage,
  ): Promise<void>;
}
