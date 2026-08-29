import { parse } from "acorn";

/** A JavaScript syntax error found before proposed Gadget files are accepted. */
export class GadgetSyntaxError extends Error {
  /** Creates a user-facing error naming the Gadget file and parser location. */
  constructor(bindingName: string, path: string, cause: unknown) {
    const position = syntaxErrorPosition(cause);
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Cannot accept changes: syntax error in ${bindingName}/${path}${position}: ${detail}`);
    this.name = "GadgetSyntaxError";
  }
}

function syntaxErrorPosition(error: unknown): string {
  if (!error || typeof error !== "object" || !("loc" in error)) return "";
  const loc = error.loc;
  if (!loc || typeof loc !== "object" || !("line" in loc) || !("column" in loc)) return "";
  return ` at ${String(loc.line)}:${Number(loc.column) + 1}`;
}

/** Parses every JavaScript file in a proposed Gadget without executing it. */
export function validateGadgetJavaScript(
    bindingName: string, files: ReadonlyMap<string, string>): void {
  for (const [path, source] of files) {
    if (!path.endsWith(".js")) continue;
    try {
      parse(source, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true });
    } catch (error) {
      throw new GadgetSyntaxError(bindingName, path, error);
    }
  }
}
