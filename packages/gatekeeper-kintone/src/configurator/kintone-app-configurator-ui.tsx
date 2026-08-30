import { Autocomplete, Field, h, Section, type ConfiguratorUISpec } from "@gadgets/configurator-ui";
import type {
  KintoneAppConfiguratorRpc,
  KintoneAppConfiguratorValues,
} from "./kintone-app-configurator-types";

export default {
  initial: {},

  isReady({ values }) {
    return typeof values.appUrl === "string" && values.appUrl.length > 0;
  },

  initialValuesFromResourceUrl({ resourceUrl }) {
    return { appUrl: resourceUrl };
  },

  resourceUrl({ values }) {
    return values.appUrl ?? "";
  },

  render({ values, setValues, ui }) {
    return <Section>
      <Field label="kintoneアプリ" description="この接続で許可されたアプリです。">
        <Autocomplete
          name="appUrl"
          value={values.appUrl}
          placeholder="接続済みのアプリ"
          loadOptions={() => ui.listApps()}
          onChange={appUrl => setValues({ appUrl })}
        />
      </Field>
    </Section>;
  },
} satisfies ConfiguratorUISpec<KintoneAppConfiguratorRpc, KintoneAppConfiguratorValues>;
