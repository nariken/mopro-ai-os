import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(sourceDir, "..");
const outputDir = resolve(sourceDir, "dist");

await rm(outputDir, { recursive: true, force: true });
await mkdir(resolve(outputDir, "assets/brand"), { recursive: true });
await mkdir(resolve(outputDir, "assets/captures"), { recursive: true });
await mkdir(resolve(outputDir, "assets/video"), { recursive: true });

const html = await readFile(resolve(sourceDir, "index.html"), "utf8");
const productionHtml = html
  .replaceAll("../assets/brand/", "./assets/brand/")
  .replaceAll("../demo-video/captures/", "./assets/captures/")
  .replaceAll("../demo-video/output/", "./assets/video/");

await writeFile(resolve(outputDir, "index.html"), productionHtml);
await cp(resolve(sourceDir, "styles.css"), resolve(outputDir, "styles.css"));
await cp(resolve(sourceDir, "script.js"), resolve(outputDir, "script.js"));

for (const file of [
  "mopro-ai-os-app-icon.svg",
  "mopro-ai-os-horizontal.svg",
  "mopro-ai-os-symbol.svg",
]) {
  await cp(resolve(repositoryRoot, "assets/brand", file), resolve(outputDir, "assets/brand", file));
}

for (const file of [
  "02-explore.png",
  "03-catalog-marketing.png",
  "05-workspace.png",
  "06-connections.png",
  "07-context-skills.png",
  "08-outro.png",
]) {
  await cp(resolve(repositoryRoot, "demo-video/captures", file), resolve(outputDir, "assets/captures", file));
}

await cp(
  resolve(repositoryRoot, "demo-video/output/mopro-ai-os-internal-demo-v1.mp4"),
  resolve(outputDir, "assets/video/mopro-ai-os-demo.mp4"),
);

const builtHtml = await readFile(resolve(outputDir, "index.html"), "utf8");
await writeFile(
  resolve(outputDir, "index.html"),
  builtHtml.replace("mopro-ai-os-internal-demo-v1.mp4", "mopro-ai-os-demo.mp4"),
);

console.log(`Built landing page at ${outputDir}`);
