"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { expandReviewContext } = require("../../out/contextExpansion");

function hunkDiff(filePath, addedLine) {
  return {
    destination: { toString: filePath },
    hunks: [
      {
        sourceLine: 1,
        sourceSpan: 1,
        destinationLine: 1,
        destinationSpan: 1,
        segments: [
          {
            type: "ADDED",
            lines: [{ line: addedLine }],
          },
        ],
      },
    ],
  };
}

function baseCfg(cacheRoot) {
  return {
    baseUrl: "https://example.com/bitbucket",
    contextExpansion: {
      enabled: true,
      cacheRoot,
      maxRelatedFiles: 8,
      maxRelatedFileChars: 8000,
      codegraphTimeoutMs: 5000,
      onNoInRepoConsumer: "suppress-speculative",
      deniedPathSegments: ["node_modules"],
    },
  };
}

function prepCachedRepo(cacheRoot) {
  const repoPath = path.join(cacheRoot, "PROJ", "repo");
  fs.mkdirSync(path.join(repoPath, ".git"), { recursive: true });
  return repoPath;
}

function mockExec(handler) {
  return (cmd, args, _opts, callback) => {
    handler(cmd, args || [], callback);
  };
}

/** Hard-fail mesaji: prefix + opsiyonel ekstra pattern (toHash, codegraph, …). */
function isHardFailMessage(err, extraPattern) {
  const message = String(err && err.message);
  if (!/CodeGraph context expansion basarisiz|review iptal/i.test(message)) {
    return false;
  }
  if (extraPattern && !extraPattern.test(message)) {
    return false;
  }
  return true;
}

(async () => {
  const cacheRoot = path.join(__dirname, ".tmp-expand-hardfail");
  fs.rmSync(cacheRoot, { recursive: true, force: true });
  fs.mkdirSync(cacheRoot, { recursive: true });

  // toHash yok → hard fail (codegraph atlanamaz)
  await assert.rejects(
    () =>
      expandReviewContext({
        cfg: baseCfg(cacheRoot),
        projectKey: "PROJ",
        repoSlug: "repo",
        diffData: { diffs: [] },
        token: "t",
        toHash: "",
        changedFiles: [{ path: "src/a.ts", diff: {} }],
      }),
    (err) => isHardFailMessage(err, /toHash/i)
  );

  // Clone/git fail → hard fail (diff-only fallback yok)
  await assert.rejects(
    () =>
      expandReviewContext({
        cfg: baseCfg(cacheRoot),
        projectKey: "PROJ",
        repoSlug: "repo-missing",
        diffData: { diffs: [] },
        token: "t",
        toHash: "abc123",
        changedFiles: [{ path: "src/a.ts", diff: {} }],
        execFileImpl: mockExec((_cmd, _args, cb) => {
          cb(new Error("clone failed"), "", "fatal: could not read");
        }),
      }),
    (err) => isHardFailMessage(err)
  );

  // Codegraph init/sync fail → hard fail
  prepCachedRepo(cacheRoot);
  const diffData = {
    diffs: [hunkDiff("src/i18n/tr.ts", "  holdModal: {")],
  };
  await assert.rejects(
    () =>
      expandReviewContext({
        cfg: baseCfg(cacheRoot),
        projectKey: "PROJ",
        repoSlug: "repo",
        diffData,
        token: "t",
        toHash: "abc123",
        changedFiles: [{ path: "src/i18n/tr.ts", diff: {} }],
        execFileImpl: mockExec((cmd, args, cb) => {
          const name = String(cmd || "").toLowerCase();
          if (name.includes("codegraph")) {
            cb(new Error("codegraph missing"), "", "not found");
            return;
          }
          cb(null, "", "");
        }),
      }),
    (err) => isHardFailMessage(err, /codegraph/i)
  );

  // Symbol yok → related bos, review devam (hard fail degil)
  const noSymbol = await expandReviewContext({
    cfg: baseCfg(cacheRoot),
    projectKey: "PROJ",
    repoSlug: "repo",
    diffData: { diffs: [hunkDiff("src/a.ts", "  // only comment")] },
    token: "t",
    toHash: "abc123",
    changedFiles: [{ path: "src/a.ts", diff: {} }],
    execFileImpl: mockExec((_cmd, _args, cb) => cb(null, "", "")),
  });
  assert.strictEqual(noSymbol.relatedFiles.length, 0);
  assert.strictEqual(noSymbol.changedFiles[0].role, "changed");

  // force: true → enabled false olsa bile clone/codegraph yolu (toHash yok → hard fail)
  await assert.rejects(
    () =>
      expandReviewContext({
        cfg: {
          ...baseCfg(cacheRoot),
          contextExpansion: { ...baseCfg(cacheRoot).contextExpansion, enabled: false },
        },
        projectKey: "PROJ",
        repoSlug: "repo",
        diffData: { diffs: [] },
        token: "t",
        toHash: "",
        changedFiles: [{ path: "src/a.ts", diff: {} }],
        force: true,
      }),
    (err) => isHardFailMessage(err, /toHash/i)
  );

  fs.rmSync(cacheRoot, { recursive: true, force: true });
  console.log("expandReviewContext hard-fail tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
