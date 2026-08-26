import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { BlueprintMetadata } from "@gadgets/workshop-shared/api";
import { buildBlueprintArchiveStream, parseBlueprintArchive } from "../src/blueprint-archive.js";
import { scanGadgetFilesForSecrets } from "../src/gadget-secret-scan.js";

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  let stream = new Response(bytes as BodyInit).body!.pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  let decompressed = stream.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(decompressed).arrayBuffer());
}

describe("blueprint archive package round-trip", () => {
  it("preserves version, metadata, code, and a clean secret scan", async () => {
    let files = new Map([
      ["client.js", "document.body.textContent = 'Synthetic Sample';"],
      ["server.js", "export default { fetch: () => new Response('ok') };"],
    ]);
    let doc = new Y.Doc();
    let root = doc.getMap<Y.Text>();
    for (let [path, content] of files) {
      let text = new Y.Text();
      root.set(path, text);
      text.insert(0, content);
    }
    let content = await gzip(Y.encodeStateAsUpdateV2(doc));
    let created = new Date("2026-08-26T00:00:00.000Z");
    let metadata: BlueprintMetadata = {
      title: "MOP-564 round-trip",
      description: "Synthetic package import regression fixture.",
      author: { type: "user", id: "test-user", name: "Test User" },
      created,
      version: 3,
      lastUpdated: created,
      bindings: {},
    };

    let archive = buildBlueprintArchiveStream(metadata, new Response(content as BodyInit).body!,
        content.byteLength);
    let imported = await parseBlueprintArchive(archive);

    expect(imported.metadata).toEqual(metadata);
    expect(imported.metadata.version).toBe(3);
    expect(imported.contentLength).toBe(content.byteLength);

    let restoredDoc = new Y.Doc();
    Y.applyUpdateV2(restoredDoc, await gunzip(imported.content));
    let restoredFiles = new Map(
        [...restoredDoc.getMap<Y.Text>().entries()].map(([path, text]) => [path, text.toString()]));
    expect(restoredFiles).toEqual(files);
    expect(scanGadgetFilesForSecrets(restoredFiles)).toEqual([]);
  });
});
