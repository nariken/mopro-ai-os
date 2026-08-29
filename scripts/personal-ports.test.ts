import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PERSONAL_SERVICES, personalService } from "./personal-ports.ts";

describe("Personal port registry", () => {
  it("assigns every service a unique port", () => {
    let ports = PERSONAL_SERVICES.map(service => service.port);
    assert.equal(new Set(ports).size, ports.length);
  });

  it("reserves port 3000 for the MOPRO frontend", () => {
    assert.deepEqual(personalService("mopro-frontend"), {
      id: "mopro-frontend",
      owner: "MOPRO",
      port: 3000,
      tier: "core",
      url: "http://127.0.0.1:3000/",
    });
    assert.equal(personalService("multica-frontend").port, 3002);
  });
});
