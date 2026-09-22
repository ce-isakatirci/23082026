"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  resolveOcrCommand,
  needsShellForOcr,
  parseOcrJsonOutput,
  runOcrBranchReview,
  runOcrHealthCheck,
} = require("../out/ocrCliRunner");
const { createBulkAbortGate } = require("../out/bulkAbort");

assert.strictEqual(
  resolveOcrCommand({ ocrReview: { executablePath: "C:\\tools\\ocr.cmd" } }),
  "C:\\tools\\ocr.cmd"
);
assert.ok(typeof resolveOcrCommand({}) === "string");

if (process.platform === "win32") {
  assert.strictEqual(needsShellForOcr("ocr"), true);
  assert.strictEqual(needsShellForOcr("ocr.cmd"), true);
  assert.strictEqual(needsShellForOcr("C:\\bin\\ocr.exe"), false);
} else {
  assert.strictEqual(needsShellForOcr("ocr"), false);
}

const parsed = parseOcrJsonOutput(
  JSON.stringify({
    status: "success",
    comments: [
      {
        path: "main.go",
        content: "fix",
        start_line: 10,
        end_line: 12,
        severity: "critical",
      },
    ],
    llm: { provider: "anthropic", model: "claude" },
    summary: { files_reviewed: 1, elapsed: "1s" },
  })
);
assert.strictEqual(parsed.status, "success");
assert.strictEqual(parsed.comments.length, 1);
assert.strictEqual(parsed.comments[0].path, "main.go");

assert.throws(
  () => parseOcrJsonOutput("not json"),
  /JSON parse edilemedi/
);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ykb-ocr-test-"));
const outFile = path.join(tmpDir, "result.json");
fs.writeFileSync(
  outFile,
  JSON.stringify({
    status: "success",
    comments: [{ path: "a.java", start_line: 1, content: "x", severity: "low" }],
    llm: { provider: "p", model: "m" },
  }),
  "utf8"
);

let capturedArgs = null;
const mockExec = (cmd, args, opts, cb) => {
  capturedArgs = { cmd, args, opts };
  const child = { kill() {} };
  process.nextTick(() => cb(null, "", ""));
  return child;
};

(async () => {
  const result = await runOcrBranchReview({
    repoPath: tmpDir,
    fromRef: "origin/dev",
    toRef: "origin/feature/x",
    outputPath: outFile,
    cfg: {
      ocrReview: {
        executablePath: "ocr",
        audience: "agent",
        timeoutMinutes: 5,
      },
    },
    execFileImpl: mockExec,
  });
  assert.ok(capturedArgs);
  assert.ok(capturedArgs.args.includes("review"));
  assert.ok(capturedArgs.args.includes("--from"));
  assert.ok(capturedArgs.args.includes("origin/dev"));
  assert.ok(capturedArgs.args.includes("--to"));
  assert.ok(capturedArgs.args.includes("origin/feature/x"));
  assert.ok(capturedArgs.args.includes("--format"));
  assert.ok(capturedArgs.args.includes("json"));
  assert.ok(capturedArgs.args.includes("--audience"));
  assert.ok(capturedArgs.args.includes("agent"));
  assert.ok(capturedArgs.args.includes("--output"));
  assert.strictEqual(result.comments.length, 1);
  assert.ok(result.modelLabel.includes("p"));

  const healthOk = await runOcrHealthCheck(
    { ocrReview: { executablePath: "ocr" } },
    (cmd, args, opts, cb) => {
      assert.deepStrictEqual(args, ["llm", "test"]);
      process.nextTick(() => cb(null, "ok", ""));
      return { kill() {} };
    }
  );
  assert.strictEqual(healthOk.ok, true);

  const healthFail = await runOcrHealthCheck(
    { ocrReview: { executablePath: "ocr" } },
    (cmd, args, opts, cb) => {
      process.nextTick(() => cb(new Error("fail"), "", "no config"));
      return { kill() {} };
    }
  );
  assert.strictEqual(healthFail.ok, false);
  assert.ok(/OCR CLI/.test(healthFail.message));

  // abort during run
  const gate = createBulkAbortGate();
  let killCalled = false;
  try {
    await runOcrBranchReview({
      repoPath: tmpDir,
      fromRef: "origin/dev",
      toRef: "origin/feat",
      outputPath: path.join(tmpDir, "never.json"),
      cfg: { ocrReview: { executablePath: "ocr", timeoutMinutes: 1 } },
      abortGate: gate,
      execFileImpl: (cmd, args, opts, cb) => {
        const child = {
          kill() {
            killCalled = true;
          },
        };
        gate.abort();
        process.nextTick(() => cb(new Error("killed"), "", ""));
        return child;
      },
    });
    assert.fail("abort bekleniyordu");
  } catch (err) {
    assert.ok(err && (err.code === "BULK_ABORT" || /durduruldu/i.test(err.message)));
  }
  assert.ok(killCalled, "abort child.kill cagirmali");

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  console.log("ocrCliRunner tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
