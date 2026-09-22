"use strict";

const assert = require("assert");
const {
  truncateCrgContext,
  formatCrgContextSection,
  buildCrgModelLabel,
  crgSkillsLine,
} = require("../out/crgReviewAdapter");

const short = truncateCrgContext("hello", 100);
assert.strictEqual(short.truncated, false);
assert.strictEqual(short.text, "hello");

const long = truncateCrgContext("x".repeat(200), 50);
assert.strictEqual(long.truncated, true);
assert.ok(long.text.length <= 50);
assert.ok(long.text.includes("truncated"));
assert.strictEqual(long.originalChars, 200);

const section = formatCrgContextSection("impact: Foo.bar\n", {
  maxChars: 10000,
  baseRef: "origin/dev",
});
assert.ok(section.includes("## code-review-graph context"));
assert.ok(section.includes("detect-changes --base origin/dev"));
assert.ok(section.includes("impact: Foo.bar"));

const empty = formatCrgContextSection("   ", { baseRef: "origin/main" });
assert.ok(empty.includes("boş çıktı"));
assert.ok(empty.includes("origin/main"));

assert.strictEqual(
  buildCrgModelLabel("gpt-5.4-mini"),
  "code-review-graph + gpt-5.4-mini"
);
assert.ok(buildCrgModelLabel("").includes("Copilot"));
assert.ok(crgSkillsLine().includes("detect-changes"));

console.log("crgReviewAdapter tests OK");
