import { describe, expect, it } from "vitest";
import { validateGadgetJavaScript } from "../src/gadget-syntax-validation";

describe("validateGadgetJavaScript", () => {
  it("accepts modules and ignores non-JavaScript files", () => {
    expect(() => validateGadgetJavaScript("APP", new Map([
      ["server.js", "export class Gadget {}"],
      ["client.js", "await Promise.resolve();"],
      ["README.md", "```js\nthis is not parsed\n```"],
    ]))).not.toThrow();
  });

  it("reports the Gadget, file, and location for malformed JavaScript", () => {
    expect(() => validateGadgetJavaScript("APP", new Map([
      ["client.js", "function state( {"],
    ]))).toThrow(/APP\/client\.js at 1:18/);
  });
});
