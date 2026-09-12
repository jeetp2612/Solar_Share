import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  APP_ENV_REL_PATH,
  mergeAppEnv,
  parseAppEnv,
  parseDotEnv,
  projectRoot,
  readAppEnv,
  readDotEnv,
} from "./with-app-env.mjs";

const execFileAsync = promisify(execFile);
const WRAPPER = join(projectRoot(), "scripts/with-app-env.mjs");
const PRINT_FLAG = "process.stdout.write(String(process.env.VITE_AUTH_ENABLED));";

function makeWorkspace(appEnvJson) {
  const root = mkdtempSync(join(tmpdir(), "app-env-"));
  if (appEnvJson !== undefined) {
    mkdirSync(join(root, ".grok"), { recursive: true });
    writeFileSync(join(root, APP_ENV_REL_PATH), appEnvJson);
  }
  return root;
}

test("keeps VITE_-prefixed string entries", () => {
  assert.deepEqual(parseAppEnv('{"VITE_AUTH_ENABLED":"false"}'), {
    VITE_AUTH_ENABLED: "false",
  });
});

test("drops non-VITE keys, non-string values and malformed documents", () => {
  assert.deepEqual(parseAppEnv('{"DATABASE_URL":"postgres://x","VITE_N":1,"VITE_OK":"y"}'), {
    VITE_OK: "y",
  });
  assert.deepEqual(parseAppEnv("not json"), {});
  assert.deepEqual(parseAppEnv('["VITE_AUTH_ENABLED"]'), {});
  assert.deepEqual(parseAppEnv("null"), {});
});

test("a missing app-env.json is a clean no-op", () => {
  assert.deepEqual(readAppEnv(makeWorkspace()), {});
});

test("reads the app env from a workspace", () => {
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  assert.deepEqual(readAppEnv(root), { VITE_AUTH_ENABLED: "false" });
});

test("an explicit process-env override wins over the file", () => {
  const merged = mergeAppEnv(
    { VITE_AUTH_ENABLED: "false" },
    { VITE_AUTH_ENABLED: "true", PATH: "/usr/bin" },
  );
  assert.equal(merged.VITE_AUTH_ENABLED, "true");
  assert.equal(merged.PATH, "/usr/bin");
});

test("the template ships auth ON (real email/password profiles)", () => {
  // SolarShare uses real accounts: profiles/wallets are per-user in SQL, so
  // sign-in must be enabled (flipped from the template's off-by-default).
  assert.deepEqual(readAppEnv(projectRoot()), { VITE_AUTH_ENABLED: "true" });
});

test("vite loadEnv resolves the wrapped value", () => {
  // What `import.meta.env.VITE_AUTH_ENABLED` becomes: loadEnv prefix-matches
  // process.env, so the wrapper's merge has to land before Vite starts.
  // Do not `import { loadEnv } from "vite"` here — Vite 8 loads rolldown
  // native bindings that SIGSEGV the test worker under qemu-user.
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  const merged = mergeAppEnv(readAppEnv(root), { PATH: "/usr/bin" });
  assert.equal(merged.VITE_AUTH_ENABLED, "false");
});

test("the wrapped command runs with the app env applied", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    WRAPPER,
    process.execPath,
    "-e",
    PRINT_FLAG,
  ]);
  assert.equal(stdout, "true");
});

test("the wrapped command sees an explicit override, not the file value", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [WRAPPER, process.execPath, "-e", PRINT_FLAG],
    { env: { ...process.env, VITE_AUTH_ENABLED: "true" } },
  );
  assert.equal(stdout, "true");
});

test("the wrapper propagates the command's exit code", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [WRAPPER, process.execPath, "-e", "process.exit(3)"]),
    (err) => err.code === 3,
  );
});

test("a signal-killed command is never reported as success", async () => {
  // The wrapper's own SIGTERM handler must not swallow the re-raised signal:
  // a cancelled build reporting exit 0 is a silently passing gate.
  await assert.rejects(
    execFileAsync(process.execPath, [
      WRAPPER,
      process.execPath,
      "-e",
      "process.kill(process.pid, 'SIGTERM');setTimeout(() => {}, 1000);",
    ]),
    (err) => err.signal === "SIGTERM" || err.code !== 0,
  );
});

test("the CLI still runs when invoked through a symlinked path", async () => {
  // node realpaths import.meta.url but not process.argv[1], so a raw comparison
  // turns the wrapper into a no-op that exits 0 without starting anything.
  const link = join(mkdtempSync(join(tmpdir(), "app-env-link-")), "scripts");
  symlinkSync(join(projectRoot(), "scripts"), link);
  const { stdout } = await execFileAsync(process.execPath, [
    join(link, "with-app-env.mjs"),
    process.execPath,
    "-e",
    PRINT_FLAG,
  ]);
  assert.equal(stdout, "true");
});

test("parseDotEnv reads KEY=VALUE lines, comments, export and quotes", () => {
  assert.deepEqual(
    parseDotEnv(
      [
        "# a comment",
        "",
        "DATABASE_URL=postgres://user:pw@localhost:5432/solarshare",
        "QUOTED=\"hello world\" # trailing comment after quotes stays",
        "SINGLE='v1'",
        "export EXPORTED=yes",
        "UNQUOTED=abc # inline comment",
        "NOEQUALS",
        "9BAD=1",
        "=nokey",
      ].join("\n"),
    ),
    {
      DATABASE_URL: "postgres://user:pw@localhost:5432/solarshare",
      QUOTED: "hello world",
      SINGLE: "v1",
      EXPORTED: "yes",
      UNQUOTED: "abc",
    },
  );
});

test("readDotEnv is a no-op without files; .env.local beats .env", () => {
  assert.deepEqual(readDotEnv(mkdtempSync(join(tmpdir(), "app-env-dotenv-none-"))), {});
  const root = mkdtempSync(join(tmpdir(), "app-env-dotenv-"));
  writeFileSync(join(root, ".env"), "DATABASE_URL=postgres://from-dot-env\nVITE_A=1\n");
  assert.deepEqual(readDotEnv(root), {
    DATABASE_URL: "postgres://from-dot-env",
    VITE_A: "1",
  });
  writeFileSync(join(root, ".env.local"), "DATABASE_URL=postgres://from-local\n");
  assert.deepEqual(readDotEnv(root), {
    DATABASE_URL: "postgres://from-local",
    VITE_A: "1",
  });
});

test("a .env.local value reaches the wrapped command (DATABASE_URL flow)", async () => {
  // Full wiring: the wrapper copied into a scratch workspace (projectRoot()
  // is script-relative, so the scratch root becomes its root) with a
  // .env.local — the exact flow "put DATABASE_URL in .env.local, npm run dev".
  const root = mkdtempSync(join(tmpdir(), "app-env-e2e-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(join(projectRoot(), "scripts/with-app-env.mjs"), join(root, "scripts/with-app-env.mjs"));
  writeFileSync(
    join(root, ".env.local"),
    'DATABASE_URL="postgres://u:p@localhost:5432/solarshare"\n',
  );
  const { stdout } = await execFileAsync(process.execPath, [
    join(root, "scripts/with-app-env.mjs"),
    process.execPath,
    "-e",
    'process.stdout.write(String(process.env.DATABASE_URL));',
  ]);
  assert.equal(stdout, "postgres://u:p@localhost:5432/solarshare");
});

test("an explicit process-env DATABASE_URL beats .env.local", async () => {
  const root = mkdtempSync(join(tmpdir(), "app-env-e2e-override-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(join(projectRoot(), "scripts/with-app-env.mjs"), join(root, "scripts/with-app-env.mjs"));
  writeFileSync(join(root, ".env.local"), "DATABASE_URL=postgres://from-file\n");
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      join(root, "scripts/with-app-env.mjs"),
      process.execPath,
      "-e",
      "process.stdout.write(String(process.env.DATABASE_URL));",
    ],
    { env: { ...process.env, DATABASE_URL: "postgres://from-process" } },
  );
  assert.equal(stdout, "postgres://from-process");
});
