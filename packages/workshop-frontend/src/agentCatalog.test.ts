import { describe, expect, it } from "vitest";
import { AGENT_CATALOG, AGENT_ROLES } from "./agentCatalog";

describe("agent catalog", () => {
  it("contains a focused catalog with at least three agents for every role", () => {
    expect(AGENT_CATALOG).toHaveLength(25);
    for (const role of AGENT_ROLES) {
      expect(AGENT_CATALOG.filter((item) => item.role === role).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses stable unique ids and complete setup metadata", () => {
    expect(new Set(AGENT_CATALOG.map((item) => item.id)).size).toBe(AGENT_CATALOG.length);
    for (const item of AGENT_CATALOG) {
      expect(item.id).toMatch(/^[a-z0-9-]+$/);
      expect(item.connections.length).toBeGreaterThan(0);
      expect(item.prompt).toContain(item.title);
      expect(item.prompt).toContain(item.metric);
      expect(item.prompt).toContain("Never perform an external write twice");
    }
  });
});
