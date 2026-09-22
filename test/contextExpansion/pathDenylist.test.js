"use strict";

const assert = require("assert");
const {
  isAllowedRepoPath,
  buildDeniedSegmentSet,
  DEFAULT_DENIED_SEGMENTS,
} = require("../../out/contextExpansion/pathDenylist");

assert.strictEqual(isAllowedRepoPath("src/Foo.tsx"), true);
assert.strictEqual(isAllowedRepoPath("src\\components\\Bar.java"), true);
assert.strictEqual(
  isAllowedRepoPath("node_modules/cosmos-common-ui/HoldModal/index.tsx"),
  false
);
assert.strictEqual(isAllowedRepoPath("target/classes/Foo.class"), false);
assert.strictEqual(isAllowedRepoPath(".git/config"), false);
assert.strictEqual(isAllowedRepoPath("src/test/java/Foo.java"), false);
assert.strictEqual(isAllowedRepoPath("__tests__/a.js"), false);

const custom = buildDeniedSegmentSet(["vendor"]);
assert.strictEqual(isAllowedRepoPath("vendor/pkg/a.js", ["vendor"]), false);
assert.strictEqual(DEFAULT_DENIED_SEGMENTS.includes("node_modules"), true);
assert.strictEqual(DEFAULT_DENIED_SEGMENTS.includes("test"), true);

console.log("pathDenylist tests OK");
