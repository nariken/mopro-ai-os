import { Field, Section, type ConfiguratorUISpec } from "@gadgets/configurator-ui";
import type {
  GhostPublicationConfiguratorRpc,
  GhostPublicationConfiguratorValues,
} from "./publication-configurator-types";

export default {
  initial: { confirmed: "yes" },
  isReady() { return true; },
  resourceUrl({ ui }) { return ui.resourceUrl(); },
  render() {
    return <Section>
      <Field
        label="Draft-only publication access"
        description="This binding can inspect, create, and update drafts in the connected Ghost publication. It cannot publish, schedule, email, delete, or change site settings.">
      </Field>
    </Section>;
  },
} satisfies ConfiguratorUISpec<GhostPublicationConfiguratorRpc, GhostPublicationConfiguratorValues>;
