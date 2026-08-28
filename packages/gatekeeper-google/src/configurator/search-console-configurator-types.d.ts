export type ConfiguratorOption = {
  value: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

export type SearchConsoleConfiguratorValues = {
  siteUrl?: string | null;
}

export interface SearchConsoleConfiguratorRpc {
  listProperties(query: string): Promise<ConfiguratorOption[]>;
}
