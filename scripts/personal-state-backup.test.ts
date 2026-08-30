import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createPersonalBackup, restorePersonalBackup, verifyPersonalBackup } from "./personal-state-backup.ts";

const execFileAsync = promisify(execFile);

test("Personal state backup verifies and restores without overwriting", async () => {
  let work = await mkdtemp(join(tmpdir(), "mopro-personal-backup-test-"));
  try {
    let source = join(work, "source");
    await mkdir(join(source, "do"), { recursive: true });
    await writeFile(join(source, "blob.txt"), "synthetic state");
    let database = join(source, "do", "state.sqlite");
    await execFileAsync("sqlite3", [database, "CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('ok');"]);

    let archive = join(work, "backup.tar.gz");
    let created = await createPersonalBackup(source, archive);
    let verified = await verifyPersonalBackup(archive);
    assert.deepEqual(verified.files, created.files);

    let restored = join(work, "restored");
    await restorePersonalBackup(archive, restored);
    assert.equal(await readFile(join(restored, "blob.txt"), "utf8"), "synthetic state");
    let { stdout } = await execFileAsync("sqlite3", [join(restored, "do", "state.sqlite"),
      "SELECT value FROM sample;"]);
    assert.equal(stdout.trim(), "ok");
    await assert.rejects(restorePersonalBackup(archive, restored), /already exists/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
