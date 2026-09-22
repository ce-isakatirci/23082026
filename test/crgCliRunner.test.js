"use strict";

const assert = require("assert");
const path = require("path");
const {
  resolveCrgCommand,
  needsShellForCrg,
  runCrgHealthCheck,
  ensureCrgGraph,
  runCrgDetectChanges,
  hasGraphDb,
} = require("../out/crgCliRunner");
const { createBulkAbortGate } = require("../out/bulkAbort");

assert.strictEqual(
  resolveCrgCommand({ crgReview: { executablePath: "C:\\tools\\code-review-graph.cmd" } }),
  "C:\\tools\\code-review-graph.cmd"
);
assert.ok(typeof resolveCrgCommand({}) === "string");

if (process.platform === "win32") {
  assert.strictEqual(needsShellForCrg("code-review-graph"), true);
  assert.strictEqual(needsShellForCrg("code-review-graph.cmd"), true);
  assert.strictEqual(needsShellForCrg("C:\\bin\\code-review-graph.exe"), false);
} else {
  assert.strictEqual(needsShellForCrg("code-review-graph"), false);
}

assert.strictEqual(hasGraphDb(__dirname), false);

let captured = null;
const mockOk = (cmd, args, opts, cb) => {
  captured = { cmd, args, opts };
  process.nextTick(() => cb(null, "Usage: code-review-graph\ndetect-changes\n", ""));
  return { kill() {} };
};

(async () => {
  const healthOk = await runCrgHealthCheck(
    { crgReview: { executablePath: "code-review-graph" } },
    mockOk
  );
  assert.strictEqual(healthOk.ok, true);
  assert.deepStrictEqual(captured.args, ["--help"]);

  const healthFail = await runCrgHealthCheck(
    { crgReview: { executablePath: "code-review-graph" } },
    (cmd, args, opts, cb) => {
      process.nextTick(() => cb(new Error("ENOENT"), "", "not found"));
      return { kill() {} };
    }
  );
  assert.strictEqual(healthFail.ok, false);
  assert.ok(/pip install/i.test(healthFail.message));

  const fs = require("fs");
  const os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ykb-crg-"));
  let modeArgs = null;
  await ensureCrgGraph({
    repoPath: tmp,
    cfg: { crgReview: { executablePath: "code-review-graph", timeoutMinutes: 1 } },
    execFileImpl: (cmd, args, opts, cb) => {
      modeArgs = args;
      process.nextTick(() => cb(null, "built", ""));
      return { kill() {} };
    },
  });
  assert.deepStrictEqual(modeArgs, ["build"]);

  const graphDir = path.join(tmp, ".code-review-graph");
  fs.mkdirSync(graphDir, { recursive: true });
  fs.writeFileSync(path.join(graphDir, "graph.db"), "x");
  await ensureCrgGraph({
    repoPath: tmp,
    cfg: { crgReview: { executablePath: "code-review-graph", timeoutMinutes: 1 } },
    execFileImpl: (cmd, args, opts, cb) => {
      modeArgs = args;
      process.nextTick(() => cb(null, "updated", ""));
      return { kill() {} };
    },
  });
  assert.deepStrictEqual(modeArgs, ["update"]);

  let detectArgs = null;
  const detected = await runCrgDetectChanges({
    repoPath: tmp,
    baseRef: "origin/dev",
    cfg: { crgReview: { executablePath: "crg", timeoutMinutes: 1 } },
    execFileImpl: (cmd, args, opts, cb) => {
      detectArgs = args;
      process.nextTick(() => cb(null, "risk: high\nfiles: a.java\n", ""));
      return { kill() {} };
    },
  });
  assert.ok(detectArgs.includes("detect-changes"));
  assert.ok(detectArgs.includes("--base"));
  assert.ok(detectArgs.includes("origin/dev"));
  assert.ok(detectArgs.includes("--brief"));
  assert.ok(detected.contextText.includes("risk: high"));

  const gate = createBulkAbortGate();
  gate.abort();
  let threw = false;
  try {
    await runCrgDetectChanges({
      repoPath: tmp,
      baseRef: "origin/dev",
      cfg: { crgReview: { executablePath: "crg" } },
      abortGate: gate,
      execFileImpl: (cmd, args, opts, cb) => {
        process.nextTick(() => cb(null, "x", ""));
        return { kill() {} };
      },
    });
  } catch (err) {
    threw = true;
    assert.strictEqual(err.code, "BULK_ABORT");
  }
  assert.ok(threw, "abortGate throw etmeli");

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  console.log("crgCliRunner tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
