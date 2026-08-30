export type KintoneAppConfiguratorOption = {
  value: string;
  title: string;
  subtitle: string;
};

export type KintoneAppConfiguratorValues = {
  appUrl?: string | null;
};

export interface KintoneAppConfiguratorRpc {
  listApps(): Promise<KintoneAppConfiguratorOption[]>;
}
