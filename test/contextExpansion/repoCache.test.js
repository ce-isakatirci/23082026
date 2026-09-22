"use strict";

const assert = require("assert");
const path = require("path");
const {
  buildCloneUrl,
  tryAcquireLock,
  releaseLock,
  syncExistingRepoAndCheckout,
  isProcessAlive,
  STASH_MESSAGE,
} = require("../../out/contextExpansion/repoCache");
const { getRepoCacheDir } = require("../../out/contextExpansion/config");

const url = buildCloneUrl(
  "https://sdlc.yapikredi.com.tr/bitbucket",
  "COSSWIFT",
  "cosmos-swift-money-transfer-ui"
);
assert.ok(url.includes("/scm/COSSWIFT/cosmos-swift-money-transfer-ui.git"));

const cfg = {
  cacheRoot: path.join(__dirname, ".tmp-cache"),
  maxRelatedFiles: 8,
  maxRelatedFileChars: 8000,
  codegraphTimeoutMs: 120000,
  enabled: true,
  onNoInRepoConsumer: "suppress-speculative",
  deniedPathSegments: ["node_modules"],
};
const cacheDir = getRepoCacheDir(cfg, "PROJ", "repo-slug");
assert.ok(cacheDir.endsWith(path.join("PROJ", "repo-slug")));

const lockDir = path.join(__dirname, ".tmp-lock-test");
require("fs").mkdirSync(lockDir, { recursive: true });
const lock1 = tryAcquireLock(lockDir);
assert.ok(lock1);
const lock2 = tryAcquireLock(lockDir);
assert.strictEqual(lock2, null);
releaseLock(lock1);
const lock3 = tryAcquireLock(lockDir);
assert.ok(lock3);
releaseLock(lock3);

// Ölü PID'li stale lock → hemen alınmalı (15 dk mtime beklemeden)
const fs = require("fs");
const deadLockPath = path.join(lockDir, ".review.lock");
fs.writeFileSync(deadLockPath, "1"); // PID 1 genelde bu user için erişilemez/ölü; yoksa EPERM=canlı
if (!isProcessAlive(1)) {
  const stolen = tryAcquireLock(lockDir);
  assert.ok(stolen, "ölü PID lock çalınmalı");
  releaseLock(stolen);
} else {
  // Ortamda PID 1 canlıysa (nadir): sentetik ölü PID yaz
  fs.writeFileSync(deadLockPath, "2147483646");
  assert.strictEqual(isProcessAlive(2147483646), false);
  const stolen = tryAcquireLock(lockDir);
  assert.ok(stolen, "ölü PID lock çalınmalı");
  releaseLock(stolen);
}

function argsKey(args) {
  return (args || []).join(" ");
}

function argsMatch(args, pattern) {
  return pattern.test(argsKey(args));
}

function mockGitSequence(steps) {
  let index = 0;
  return (_cmd, args, _opts, callback) => {
    const step = steps[index];
    index += 1;
    if (!step) {
      callback(null, "", "");
      return;
    }
    if (!argsMatch(args, step.match)) {
      callback(new Error("unexpected git: " + argsKey(args)), "", "");
      return;
    }
    if (step.fail) {
      callback(new Error(step.fail), step.stderr || "", "");
      return;
    }
    callback(null, step.stdout || "", "");
  };
}

(async () => {
  const execMock = mockGitSequence([
    { match: /fetch --all --prune/ },
    { match: /reset --hard HEAD/ },
    { match: /clean -fd/ },
    { match: /fetch origin abc123/ },
    {
      match: /checkout --detach FETCH_HEAD/,
      fail: "local changes would be overwritten",
    },
    { match: /reset --hard HEAD/ },
    { match: new RegExp(`stash push -u -m ${STASH_MESSAGE}`) },
    { match: /reset --hard HEAD/ },
    { match: /clean -fd/ },
    { match: /fetch origin abc123/ },
    { match: /checkout --detach FETCH_HEAD/ },
  ]);

  await syncExistingRepoAndCheckout(
    "/fake/repo",
    "abc123",
    "token",
    5000,
    execMock
  );

  console.log("repoCache tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
