/** Values used by the Ghost publication configurator. */
export type GhostPublicationConfiguratorValues = { confirmed?: string | null };

/** Privileged configurator API for resolving the connected publication URL. */
export interface GhostPublicationConfiguratorRpc {
  /** Return the canonical URL of the connected Ghost publication. */
  resourceUrl(): Promise<string>;
}
