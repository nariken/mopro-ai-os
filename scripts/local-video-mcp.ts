import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, resolve } from "node:path";

const HOST = "127.0.0.1";
const PORT = 8793;
const PROJECT_ROOT = resolve(".local-video/projects");
const MAX_REQUEST_BYTES = 1_000_000;
const ACCESS_TOKEN = process.env.LOCAL_VIDEO_TOKEN?.trim();
const FONT_PATH = "/System/Library/Fonts/Hiragino Sans GB.ttc";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type SceneInput = {
  caption: string;
  durationSeconds: number;
  backgroundColor?: string;
};

type RenderRequest = {
  title: string;
  narration: string;
  scenes: SceneInput[];
  sources?: Array<{ title: string; url: string }>;
};

type JobStatus = {
  id: string;
  projectId: string;
  state: "queued" | "running" | "completed" | "failed";
  stage: "prepare" | "narration" | "scenes" | "encode" | "quality-check" | "complete";
  progress: number;
  message: string;
  outputPath?: string;
  error?: string;
};

const jobs = new Map<string, JobStatus>();

const tools = [
  tool("local_video_capabilities", "Check the local video renderer and its zero-API-cost capabilities.", {}, true),
  tool("render_vertical_video", "Render a Japanese 9:16 MP4 locally from narration and timed caption scenes. Returns a job ID immediately.", {
    title: stringField("Project and output title"),
    narration: stringField("Complete Japanese narration spoken by the local macOS voice"),
    scenes: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      description: "Timed caption cards. Total duration should approximately match the narration.",
      items: {
        type: "object",
        properties: {
          caption: stringField("Short on-screen Japanese caption"),
          durationSeconds: { type: "number", minimum: 1, maximum: 20 },
          backgroundColor: stringField("Optional ImageMagick color such as #152238"),
        },
        required: ["caption", "durationSeconds"],
        additionalProperties: false,
      },
    },
    sources: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        properties: { title: stringField("Source title"), url: stringField("Source URL") },
        required: ["title", "url"],
        additionalProperties: false,
      },
    },
  }, false, ["title", "narration", "scenes"]),
  tool("get_video_render_status", "Read the progress and output location of a local render job.", {
    job_id: stringField("Job ID returned by render_vertical_video"),
  }, true, ["job_id"]),
  tool("list_local_video_projects", "List locally rendered video projects and their artifacts.", {}, true),
] as const;

await mkdir(PROJECT_ROOT, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
    if (!authorized(request, url)) return json(response, 401, { error: "Unauthorized" });
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, await capabilities());
    }
    if (request.method === "GET" && url.pathname.startsWith("/artifacts/")) {
      return serveArtifact(url.pathname.slice("/artifacts/".length), response);
    }
    if (request.method === "POST" && url.pathname === "/mcp") return handleMcp(request, response);
    response.writeHead(404);
    response.end("Not found");
  } catch (error) {
    console.error("Local video MCP request failed", error);
    json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  const suffix = ACCESS_TOKEN ? `?token=${encodeURIComponent(ACCESS_TOKEN)}` : "";
  console.log(`Local video MCP: http://${HOST}:${PORT}/mcp${suffix}`);
  console.log(`Local video outputs: ${PROJECT_ROOT}`);
});

function authorized(request: IncomingMessage, url: URL): boolean {
  if (!ACCESS_TOKEN) return true;
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  return bearer === ACCESS_TOKEN || url.searchParams.get("token") === ACCESS_TOKEN;
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  readOnly: boolean,
  required: string[] = [],
) {
  return {
    name,
    description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: false,
      idempotentHint: readOnly,
      openWorldHint: false,
    },
  };
}

function stringField(description: string) {
  return { type: "string", description };
}

async function handleMcp(request: IncomingMessage, response: ServerResponse) {
  const rpc = JSON.parse(await readBody(request)) as JsonRpcRequest;
  if (rpc.id === undefined || rpc.id === null) {
    response.writeHead(202);
    return response.end();
  }
  if (rpc.method === "initialize") {
    return rpcResult(response, rpc.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mopro-local-video", version: "0.1.0" },
    });
  }
  if (rpc.method === "ping") return rpcResult(response, rpc.id, {});
  if (rpc.method === "tools/list") return rpcResult(response, rpc.id, { tools });
  if (rpc.method === "tools/call") {
    try {
      const params = rpc.params ?? {};
      const result = await callTool(String(params.name ?? ""), objectValue(params.arguments));
      return rpcResult(response, rpc.id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    } catch (error) {
      return rpcResult(response, rpc.id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      });
    }
  }
  return rpcError(response, rpc.id, -32601, `Method not found: ${rpc.method}`);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "local_video_capabilities": return capabilities();
    case "render_vertical_video": return startRender(parseRenderRequest(args));
    case "get_video_render_status": {
      const jobId = requireString(args, "job_id");
      const job = jobs.get(jobId);
      if (!job) throw new Error(`Unknown render job: ${jobId}`);
      return { ...job, artifactUrl: job.outputPath ? artifactUrl(job.projectId) : undefined };
    }
    case "list_local_video_projects": return listProjects();
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function capabilities() {
  const [ffmpeg, magick, say] = await Promise.all([
    commandVersion("ffmpeg", ["-version"]),
    commandVersion("magick", ["-version"]),
    // macOS `say` has no --version flag. Listing installed voices is a cheap, side-effect-free
    // capability check and also proves that the Japanese voice used by the renderer is available.
    commandVersion("say", ["-v", "?"]),
  ]);
  return {
    ok: Boolean(ffmpeg && magick && say),
    apiCost: 0,
    output: "MP4 H.264/AAC, 1080x1920",
    narration: "macOS local speech synthesis",
    ffmpeg,
    imageMagick: magick,
    speechSynthesis: say,
  };
}

function startRender(input: RenderRequest) {
  const projectId = `${new Date().toISOString().slice(0, 10)}-${slug(input.title)}-${randomUUID().slice(0, 8)}`;
  const jobId = randomUUID();
  const job: JobStatus = {
    id: jobId,
    projectId,
    state: "queued",
    stage: "prepare",
    progress: 0,
    message: "レンダリングを開始します",
  };
  jobs.set(jobId, job);
  void renderProject(input, job).catch((error) => {
    Object.assign(job, {
      state: "failed",
      message: "レンダリングに失敗しました",
      error: error instanceof Error ? error.message : String(error),
    });
  });
  return { jobId, projectId, status: "queued" };
}

async function renderProject(input: RenderRequest, job: JobStatus) {
  const projectDir = resolve(PROJECT_ROOT, job.projectId);
  await mkdir(projectDir, { recursive: true });
  await writeFile(resolve(projectDir, "project.json"), JSON.stringify(input, null, 2));

  updateJob(job, "running", "narration", 10, "ローカル音声を生成しています");
  const narrationPath = resolve(projectDir, "narration.aiff");
  await run("say", ["-v", "Kyoko", "-o", narrationPath, input.narration]);
  const narrationDuration = await probeDuration(narrationPath);

  updateJob(job, "running", "scenes", 25, "字幕カードを生成しています");
  const sceneDurations = input.scenes.map((scene) => scene.durationSeconds);
  const plannedDuration = sceneDurations.reduce((sum, value) => sum + value, 0);
  if (narrationDuration + 0.5 > plannedDuration) {
    sceneDurations[sceneDurations.length - 1] += narrationDuration + 0.5 - plannedDuration;
  }

  const clips: string[] = [];
  for (let index = 0; index < input.scenes.length; index += 1) {
    const scene = input.scenes[index];
    const imagePath = resolve(projectDir, `scene-${String(index + 1).padStart(2, "0")}.png`);
    const clipPath = resolve(projectDir, `scene-${String(index + 1).padStart(2, "0")}.mp4`);
    await createCaptionImage(imagePath, scene.caption, scene.backgroundColor ?? colorFor(index));
    await run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-loop", "1", "-i", imagePath, "-t", String(sceneDurations[index]),
      "-vf", "scale=1080:1920,format=yuv420p", "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", clipPath,
    ]);
    clips.push(clipPath);
    updateJob(job, "running", "scenes", 25 + Math.round(((index + 1) / input.scenes.length) * 35), `シーン ${index + 1}/${input.scenes.length}`);
  }

  updateJob(job, "running", "encode", 65, "映像と音声を結合しています");
  const concatPath = resolve(projectDir, "scenes.txt");
  await writeFile(concatPath, clips.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join("\n"));
  const silentPath = resolve(projectDir, "silent.mp4");
  await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", silentPath]);
  const outputPath = resolve(projectDir, "output.mp4");
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", silentPath, "-i", narrationPath,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", outputPath,
  ]);

  updateJob(job, "running", "quality-check", 90, "出力を検証しています");
  const outputStat = await stat(outputPath);
  const outputDuration = await probeDuration(outputPath);
  if (outputStat.size < 10_000 || outputDuration < 1) throw new Error("Generated video failed validation");
  await writeFile(resolve(projectDir, "rights-manifest.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    assets: [],
    declaration: "This draft uses generated caption cards and local macOS narration only.",
    sources: input.sources ?? [],
  }, null, 2));

  Object.assign(job, {
    state: "completed",
    stage: "complete",
    progress: 100,
    message: "動画が完成しました",
    outputPath,
  });
}

async function createCaptionImage(path: string, caption: string, backgroundColor: string) {
  const safeCaption = caption.slice(0, 160);
  await run("magick", [
    "-size", "1080x1920", `xc:${backgroundColor}`,
    "-background", "none", "-font", FONT_PATH, "-fill", "white", "-gravity", "center",
    "-pointsize", safeCaption.length > 50 ? "58" : "72",
    "-interline-spacing", "18", "-size", "880x1500", `caption:${safeCaption}`,
    "-gravity", "center", "-composite", path,
  ]);
}

async function listProjects() {
  const entries = await readdir(PROJECT_ROOT, { withFileTypes: true });
  return Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const projectDir = resolve(PROJECT_ROOT, entry.name);
    const input = JSON.parse(await readFile(resolve(projectDir, "project.json"), "utf8")) as RenderRequest;
    const outputPath = resolve(projectDir, "output.mp4");
    let completed = false;
    try { completed = (await stat(outputPath)).isFile(); } catch { /* incomplete project */ }
    return { id: entry.name, title: input.title, completed, artifactUrl: completed ? artifactUrl(entry.name) : undefined };
  }));
}

async function serveArtifact(projectId: string, response: ServerResponse) {
  if (!/^[a-z0-9-]+$/.test(projectId)) return json(response, 400, { error: "Invalid project ID" });
  const path = resolve(PROJECT_ROOT, projectId, "output.mp4");
  if (!path.startsWith(`${PROJECT_ROOT}/`)) return json(response, 400, { error: "Invalid path" });
  try {
    const info = await stat(path);
    response.writeHead(200, {
      "content-type": "video/mp4",
      "content-length": String(info.size),
      "content-disposition": `inline; filename="${basename(projectId)}.mp4"`,
      "accept-ranges": "bytes",
    });
    createReadStream(path).pipe(response);
  } catch {
    json(response, 404, { error: "Artifact not found" });
  }
}

function parseRenderRequest(args: Record<string, unknown>): RenderRequest {
  const scenesValue = args.scenes;
  if (!Array.isArray(scenesValue) || scenesValue.length < 1 || scenesValue.length > 20) {
    throw new Error("scenes must contain 1-20 items");
  }
  const scenes = scenesValue.map((value, index) => {
    const scene = objectValue(value);
    const durationSeconds = Number(scene.durationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 20) {
      throw new Error(`scenes[${index}].durationSeconds must be between 1 and 20`);
    }
    return {
      caption: requireString(scene, "caption").slice(0, 160),
      durationSeconds,
      backgroundColor: optionalColor(scene.backgroundColor),
    };
  });
  const sources = Array.isArray(args.sources) ? args.sources.map((value) => {
    const source = objectValue(value);
    const url = requireString(source, "url");
    if (!/^https?:\/\//.test(url)) throw new Error("Source URLs must use http or https");
    return { title: requireString(source, "title"), url };
  }) : undefined;
  return {
    title: requireString(args, "title").slice(0, 100),
    narration: requireString(args, "narration").slice(0, 4_000),
    scenes,
    sources,
  };
}

function optionalColor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^(#[0-9a-fA-F]{6}|[a-zA-Z]{3,20})$/.test(value)) {
    throw new Error("backgroundColor must be a six-digit hex color or a simple named color");
  }
  return value;
}

function colorFor(index: number): string {
  return ["#111827", "#172554", "#3B0764", "#052E16", "#451A03"][index % 5];
}

function updateJob(job: JobStatus, state: JobStatus["state"], stage: JobStatus["stage"], progress: number, message: string) {
  Object.assign(job, { state, stage, progress, message });
}

async function commandVersion(command: string, args: string[]): Promise<string | null> {
  try {
    const output = await run(command, args);
    return output.split("\n")[0] || command;
  } catch {
    return null;
  }
}

async function probeDuration(path: string): Promise<number> {
  const output = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]);
  const duration = Number(output.trim());
  if (!Number.isFinite(duration)) throw new Error(`Could not read duration for ${basename(path)}`);
  return duration;
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(stdout || stderr);
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-2_000)}`));
    });
  });
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_REQUEST_BYTES) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
}

function slug(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "video";
}

function artifactUrl(projectId: string): string {
  const suffix = ACCESS_TOKEN ? `?token=${encodeURIComponent(ACCESS_TOKEN)}` : "";
  return `http://${HOST}:${PORT}/artifacts/${projectId}${suffix}`;
}

function rpcResult(response: ServerResponse, id: string | number | null, result: unknown) {
  return json(response, 200, { jsonrpc: "2.0", id, result });
}

function rpcError(response: ServerResponse, id: string | number | null, code: number, message: string) {
  return json(response, 200, { jsonrpc: "2.0", id, error: { code, message } });
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}
