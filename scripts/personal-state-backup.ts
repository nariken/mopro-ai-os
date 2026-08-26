import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const BACKUP_FORMAT_VERSION = 1;

type BackupFile = { path: string; size: number; sha256: string };
type BackupManifest = {
  formatVersion: number;
  createdAt: string;
  source: string;
  files: BackupFile[];
};

function summarizeManifest(manifest: BackupManifest): object {
  return {
    formatVersion: manifest.formatVersion,
    createdAt: manifest.createdAt,
    source: manifest.source,
    fileCount: manifest.files.length,
    byteCount: manifest.files.reduce((total, file) => total + file.size, 0),
    sqliteCount: manifest.files.filter(file => file.path.endsWith(".sqlite")).length,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(root: string, current = root): Promise<string[]> {
  let result: string[] = [];
  for (let entry of await readdir(current, { withFileTypes: true })) {
    let path = join(current, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(root, path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function hashFile(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function buildManifest(stateRoot: string): Promise<BackupManifest> {
  let paths = await filesUnder(stateRoot);
  let files = await Promise.all(paths.map(async path => ({
    path: relative(stateRoot, path).split(sep).join("/"),
    size: (await stat(path)).size,
    sha256: await hashFile(path),
  })));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    source: basename(stateRoot),
    files,
  };
}

function assertSafeArchiveEntries(entries: string[]): void {
  for (let entry of entries) {
    let parts = entry.split("/");
    if (!entry || entry.startsWith("/") || parts.includes("..") ||
        (entry !== "manifest.json" && entry !== "state" && !entry.startsWith("state/"))) {
      throw new Error(`Unsafe backup archive entry: ${entry}`);
    }
  }
}

async function extractVerified(archive: string, destination: string): Promise<BackupManifest> {
  let { stdout } = await execFileAsync("tar", ["-tzf", archive]);
  assertSafeArchiveEntries(stdout.split("\n").filter(Boolean));
  await execFileAsync("tar", ["-xzf", archive, "-C", destination]);

  let manifest = JSON.parse(
      await readFile(join(destination, "manifest.json"), "utf8")) as BackupManifest;
  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION || !Array.isArray(manifest.files)) {
    throw new Error("Unsupported or invalid Personal backup manifest.");
  }

  let stateRoot = join(destination, "state");
  let actualPaths = (await filesUnder(stateRoot))
      .map(path => relative(stateRoot, path).split(sep).join("/")).toSorted();
  let expectedPaths = manifest.files.map(file => file.path).toSorted();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("Backup file list does not match its manifest.");
  }

  for (let file of manifest.files) {
    let path = join(stateRoot, ...file.path.split("/"));
    let info = await stat(path);
    if (info.size !== file.size || await hashFile(path) !== file.sha256) {
      throw new Error(`Backup checksum mismatch: ${file.path}`);
    }
  }

  // Opening a WAL-mode database can update its sibling -shm file. Verify every
  // archive byte before SQLite touches any extracted database files.
  for (let file of manifest.files) {
    if (file.path.endsWith(".sqlite")) {
      let path = join(stateRoot, ...file.path.split("/"));
      let { stdout: integrity } = await execFileAsync("sqlite3", [path, "PRAGMA integrity_check;"]);
      if (integrity.trim() !== "ok") throw new Error(`SQLite integrity check failed: ${file.path}`);
    }
  }
  return manifest;
}

/** Create a checksummed archive of a stopped Personal Wrangler state directory. */
export async function createPersonalBackup(source: string, archive: string): Promise<BackupManifest> {
  source = resolve(source);
  archive = resolve(archive);
  if (!await exists(source)) throw new Error(`Personal state directory not found: ${source}`);
  await mkdir(dirname(archive), { recursive: true });
  if (await exists(archive)) throw new Error(`Backup archive already exists: ${archive}`);

  let staging = await mkdtemp(join(tmpdir(), "mopro-personal-backup-"));
  try {
    let stagedState = join(staging, "state");
    await cp(source, stagedState, { recursive: true, preserveTimestamps: true });
    let manifest = await buildManifest(stagedState);
    await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2));
    await execFileAsync("tar", ["-czf", archive, "-C", staging, "manifest.json", "state"]);
    await verifyPersonalBackup(archive);
    return manifest;
  } catch (error) {
    await rm(archive, { force: true });
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** Verify archive paths, SHA-256 checksums, and every contained SQLite database. */
export async function verifyPersonalBackup(archive: string): Promise<BackupManifest> {
  let staging = await mkdtemp(join(tmpdir(), "mopro-personal-verify-"));
  try {
    return await extractVerified(resolve(archive), staging);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** Restore a verified Personal backup into a new path without overwriting existing state. */
export async function restorePersonalBackup(archive: string, target: string): Promise<BackupManifest> {
  target = resolve(target);
  if (await exists(target)) throw new Error(`Restore target already exists: ${target}`);
  await mkdir(dirname(target), { recursive: true });
  let staging = await mkdtemp(join(dirname(target), ".mopro-personal-restore-"));
  try {
    let manifest = await extractVerified(resolve(archive), staging);
    await rename(join(staging, "state"), target);
    return manifest;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  let [command, first, second] = process.argv.slice(2);
  if (command === "create") {
    let source = first || ".wrangler/state/v3";
    let archive = second || `backups/personal-state-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`;
    let manifest = await createPersonalBackup(source, archive);
    console.log(JSON.stringify({ command, archive: resolve(archive), ...summarizeManifest(manifest) }, null, 2));
  } else if (command === "verify" && first) {
    let manifest = await verifyPersonalBackup(first);
    console.log(JSON.stringify({ command, archive: resolve(first), ...summarizeManifest(manifest) }, null, 2));
  } else if (command === "restore" && first && second) {
    let manifest = await restorePersonalBackup(first, second);
    console.log(JSON.stringify({ command, target: resolve(second), ...summarizeManifest(manifest) }, null, 2));
  } else {
    throw new Error("Usage: personal-state-backup.ts create [source] [archive] | verify <archive> | restore <archive> <new-target>");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
