import { Autocomplete, Field, h, Section, type ConfiguratorUISpec } from "@gadgets/configurator-ui";
import type {
  SearchConsoleConfiguratorRpc, SearchConsoleConfiguratorValues,
} from "./search-console-configurator-types";

function siteUrlFromResourceUrl(resourceUrl: string): string | undefined {
  try {
    let parsed = new URL(resourceUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== "searchconsole.googleapis.com") {
      return undefined;
    }
    let match = parsed.pathname.match(/^\/property\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

export default {
  initial: {},

  isReady({ values }) {
    return typeof values.siteUrl === "string" && values.siteUrl.length > 0;
  },

  resourceUrl({ values }) {
    return `https://searchconsole.googleapis.com/property/${encodeURIComponent(values.siteUrl ?? "")}/`;
  },

  initialValuesFromResourceUrl({ resourceUrl }) {
    let siteUrl = siteUrlFromResourceUrl(resourceUrl);
    return siteUrl ? { siteUrl } : {};
  },

  render({ values, setValues, ui }) {
    return <Section>
      <Field label="Search Console property" description="Choose one property you can access.">
        <Autocomplete
          name="siteUrl"
          value={values.siteUrl}
          placeholder="Search properties..."
          loadOptions={query => ui.listProperties(query)}
          onChange={siteUrl => setValues({ siteUrl })}
        />
      </Field>
    </Section>;
  },
} satisfies ConfiguratorUISpec<SearchConsoleConfiguratorRpc, SearchConsoleConfiguratorValues>;
