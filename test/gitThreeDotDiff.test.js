"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildFeatureDiffFileName,
  buildFeatureFileDiffFileName,
  splitUnifiedDiffByFile,
  writePerFileThreeDotDiffs,
  writeThreeDotDiffFile,
} = require("../out/gitThreeDotDiff");

const stamp = new Date(2026, 8, 22, 10, 48, 0);
assert.strictEqual(
  buildFeatureDiffFileName("feature/MONYFEST-3667", stamp),
  "feature-monyfest-3667-2026-09-22T10-48-00.diff"
);
assert.strictEqual(
  buildFeatureFileDiffFileName(
    "feature/isakatirci/MONYFEST-3718",
    "src/main/java/com/ykb/nl/sepa/util/PostalAddressHelper.java",
    stamp
  ),
  "feature-isakatirci-monyfest-3718-com-ykb-nl-sepa-util-postaladdresshelper-java-2026-09-22T10-48-00.diff"
);

const split = splitUnifiedDiffByFile(
  [
    "diff --git a/src/main/java/A.java b/src/main/java/A.java",
    "--- a/src/main/java/A.java",
    "+++ b/src/main/java/A.java",
    "+a",
    "diff --git a/src/main/java/B.java b/src/main/java/B.java",
    "--- a/src/main/java/B.java",
    "+++ b/src/main/java/B.java",
    "+b",
  ].join("\n")
);
assert.strictEqual(split.length, 2);
assert.strictEqual(split[0].path, "src/main/java/A.java");
assert.strictEqual(split[1].path, "src/main/java/B.java");
assert.ok(split[0].diffText.includes("+a"));

function mockGit(diffResult) {
  const calls = [];
  function execFileImpl(cmd, args, opts, cb) {
    calls.push({ cmd, args });
    const callback = typeof opts === "function" ? opts : cb;
    const isDiff = args.includes("diff");
    if (isDiff) {
      const err = diffResult.code
        ? Object.assign(new Error("diff"), { code: diffResult.code })
        : null;
      callback(err, diffResult.stdout, diffResult.stderr || "");
      return { kill() {} };
    }
    callback(null, "abc\n", "");
    return { kill() {} };
  }
  return { calls, execFileImpl };
}

async function runPerFile(diffResult) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ykb-three-dot-"));
  const repoPath = path.join(root, "repo");
  const destDir = path.join(root, "ws");
  fs.mkdirSync(repoPath, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });
  const git = mockGit(diffResult);
  try {
    const written = await writePerFileThreeDotDiffs({
      repoPath,
      token: "",
      fromRef: "origin/dev",
      toRef: "origin/feature/MONYFEST-3667",
      featureBranch: "feature/MONYFEST-3667",
      destDir,
      date: stamp,
      execFileImpl: git.execFileImpl,
    });
    return { written, calls: git.calls, destDir, root };
  } catch (err) {
    return { error: err, calls: git.calls, destDir, root };
  }
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

(async () => {
  const ok = await runPerFile({
    code: 1,
    stdout: [
      "diff --git a/src/main/java/Foo.java b/src/main/java/Foo.java",
      "--- a/src/main/java/Foo.java",
      "+++ b/src/main/java/Foo.java",
      "+return null;",
      "diff --git a/src/main/java/Bar.java b/src/main/java/Bar.java",
      "--- a/src/main/java/Bar.java",
      "+++ b/src/main/java/Bar.java",
      "+ok;",
    ].join("\n"),
  });
  try {
    assert.ifError(ok.error);
    const diffCall = ok.calls.find((call) => call.args.includes("diff"));
    assert.ok(diffCall, "git diff çağrılmalı");
    assert.ok(diffCall.args.includes("--no-color"));
    assert.ok(
      diffCall.args.includes("origin/dev...origin/feature/MONYFEST-3667"),
      "üç nokta aralığı"
    );
    assert.ok(diffCall.args.includes("--"), "pathspec ayırıcı");
    assert.ok(
      diffCall.args.includes("src/main/java"),
      "yalnızca src/main/java"
    );
    assert.strictEqual(ok.written.files.length, 2);
    assert.ok(
      ok.written.files.every((f) => fs.existsSync(f.filePath)),
      "her dosya için .diff yazılmalı"
    );
    assert.ok(
      /feature-monyfest-3667-foo-java-2026-09-22T10-48-00\.diff$/.test(
        path.basename(ok.written.files[0].filePath)
      ) ||
        /feature-monyfest-3667-.*foo.*\.diff$/.test(
          path.basename(ok.written.files[0].filePath)
        ),
      ok.written.files[0].filePath
    );
  } finally {
    cleanup(ok.root);
  }

  const empty = await runPerFile({ code: 0, stdout: "   \n" });
  try {
    assert.ok(empty.error, "boş diff hata vermeli");
    assert.ok(/git diff boş/.test(empty.error.message), empty.error.message);
  } finally {
    cleanup(empty.root);
  }

  // Combined writer da pathspec kullanır
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ykb-combined-"));
  try {
    const repoPath = path.join(root, "repo");
    const destDir = path.join(root, "ws");
    fs.mkdirSync(repoPath, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });
    const git = mockGit({
      code: 1,
      stdout: "diff --git a/src/main/java/X.java b/src/main/java/X.java\n+x\n",
    });
    const written = await writeThreeDotDiffFile({
      repoPath,
      fromRef: "origin/dev",
      toRef: "origin/feature/x",
      featureBranch: "feature/x",
      destDir,
      date: stamp,
      execFileImpl: git.execFileImpl,
    });
    const diffCall = git.calls.find((c) => c.args.includes("diff"));
    assert.ok(diffCall.args.includes("src/main/java"));
    assert.ok(fs.existsSync(written.filePath));
  } finally {
    cleanup(root);
  }

  console.log("gitThreeDotDiff tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
