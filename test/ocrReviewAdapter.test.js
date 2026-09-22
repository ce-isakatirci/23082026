"use strict";

const assert = require("assert");
const {
  mapOcrSeverity,
  formatOcrFindingBlock,
  groupCommentsBySeverity,
  ocrJsonToReviewMarkdown,
} = require("../out/ocrReviewAdapter");

assert.strictEqual(mapOcrSeverity("critical"), "Critical");
assert.strictEqual(mapOcrSeverity("CRITICAL"), "Critical");
assert.strictEqual(mapOcrSeverity("high"), "Important");
assert.strictEqual(mapOcrSeverity("medium"), "Important");
assert.strictEqual(mapOcrSeverity("low"), "Minor");
assert.strictEqual(mapOcrSeverity("style"), "Minor");
assert.strictEqual(mapOcrSeverity(""), "Minor");

const block = formatOcrFindingBlock({
  path: "src/Foo.java",
  start_line: 42,
  end_line: 42,
  content: "Null check eksik",
  severity: "critical",
  category: "bug",
  suggestion_code: "if (x == null) return;",
});
assert.ok(block.includes("**File:** `src/Foo.java:42`"));
assert.ok(block.includes("**Issue:** Null check eksik"));
assert.ok(block.includes("**Why it matters:**"));
assert.ok(block.includes("**Suggested code:**"));
assert.ok(block.includes("if (x == null) return;"));

const rangeBlock = formatOcrFindingBlock({
  path: "a/b.ts",
  start_line: 10,
  end_line: 15,
  content: "range",
});
assert.ok(rangeBlock.includes("`a/b.ts:10-15`"));

const buckets = groupCommentsBySeverity([
  { path: "a.java", start_line: 1, severity: "critical", content: "c" },
  { path: "b.java", start_line: 2, severity: "high", content: "h" },
  { path: "c.java", start_line: 3, severity: "low", content: "l" },
  { path: "", start_line: 4, severity: "critical", content: "skip" },
]);
assert.strictEqual(buckets.Critical.length, 1);
assert.strictEqual(buckets.Important.length, 1);
assert.strictEqual(buckets.Minor.length, 1);

const emptyMd = ocrJsonToReviewMarkdown(
  { status: "success", comments: [], message: "Looks good" },
  {
    prId: "99",
    title: "Test PR",
    projectKey: "PAY",
    repoSlug: "payment",
    author: "Ali",
    fromBranch: "feature/x",
    toBranch: "dev",
  }
);
assert.ok(emptyMd.includes("# PR Review — #99 Test PR"));
assert.ok(emptyMd.includes("## Critical"));
assert.ok(emptyMd.includes("sorun yok"));
assert.ok(emptyMd.includes("feature/x → dev"));
assert.ok(emptyMd.includes("open-code-review") || emptyMd.includes("OCR"));

const fullMd = ocrJsonToReviewMarkdown(
  {
    status: "success",
    comments: [
      {
        path: "src/Service.java",
        start_line: 100,
        content: "N+1 risk",
        severity: "critical",
        suggestion_code: "join fetch",
      },
      {
        path: "src/Util.java",
        start_line: 5,
        content: "naming",
        severity: "low",
      },
    ],
    llm: { provider: "openai", model: "gpt-4" },
    summary: { elapsed: "12s", files_reviewed: 3 },
  },
  {
    prId: "1",
    title: "Fix",
    projectKey: "P",
    repoSlug: "r",
    fromBranch: "feat",
    toBranch: "dev",
  }
);
assert.ok(fullMd.includes("**File:** `src/Service.java:100`"));
assert.ok(fullMd.includes("## Critical"));
assert.ok(fullMd.includes("## Minor"));
assert.ok(fullMd.includes("openai / gpt-4"));
assert.ok(fullMd.includes("status=success"));

console.log("ocrReviewAdapter tests OK");
