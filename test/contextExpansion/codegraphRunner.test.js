"use strict";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const {
  parseFilePathsFromOutput,
  resolveCodegraphCommand,
  needsShellForCommand,
} = require("../../out/contextExpansion/codegraphRunner");

const sample =
  "src/components/Foo.tsx:42 caller\nnode_modules/pkg/x.js:1 ignore\nsrc/i18n/tr.ts:10";
const paths = parseFilePathsFromOutput(sample, ["node_modules"]);
assert.deepStrictEqual(paths.sort(), ["src/components/Foo.tsx", "src/i18n/tr.ts"].sort());

const empty = parseFilePathsFromOutput("no paths here", []);
assert.strictEqual(empty.length, 0);

// Windows: PATH'teki codegraph.cmd bulunmali (execFile ENOENT kök nedeni)
if (process.platform === "win32") {
  const binDir = path.join(__dirname, ".tmp-codegraph-bin");
  fs.rmSync(binDir, { recursive: true, force: true });
  fs.mkdirSync(binDir, { recursive: true });
  const cmdPath = path.join(binDir, "codegraph.cmd");
  fs.writeFileSync(cmdPath, "@echo offline\r\n", "utf8");

  const resolved = resolveCodegraphCommand({ PATH: binDir });
  assert.strictEqual(resolved, cmdPath);
  assert.strictEqual(needsShellForCommand(resolved), true);
  assert.strictEqual(needsShellForCommand("codegraph"), true);

  fs.rmSync(binDir, { recursive: true, force: true });
} else {
  assert.strictEqual(resolveCodegraphCommand({ PATH: "/usr/bin" }), "codegraph");
  assert.strictEqual(needsShellForCommand("codegraph"), false);
}

console.log("codegraphRunner tests OK");
