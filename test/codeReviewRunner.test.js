const assert = require("assert");
const {
  parseIssuesJson,
  applyConfidenceScores,
  selectReviewIssues,
  severityForConfidence,
  formatCodeReviewMarkdown,
  claudeMdPaths,
  extractCodeComments,
  blameRangesFromDiff,
  hasReviewableDiff,
  runCodeReview,
  scorerSystem,
  CONFIDENCE_MIN,
  CRITICAL_MIN,
  readCodeReviewThresholds,
} = require("../out/codeReviewRunner");
const { resolveInlineComments } = require("../out/prComment");

assert.strictEqual(CONFIDENCE_MIN, 80);
assert.strictEqual(CRITICAL_MIN, 90);
assert.deepStrictEqual(readCodeReviewThresholds({}), {
  minConfidence: 80,
  criticalMin: 90,
});
assert.deepStrictEqual(
  readCodeReviewThresholds({ codeReview: { minConfidence: -4, criticalMin: 140 } }),
  { minConfidence: 0, criticalMin: 100 }
);
assert.deepStrictEqual(
  readCodeReviewThresholds({ codeReview: { minConfidence: 85, criticalMin: 95 } }),
  { minConfidence: 85, criticalMin: 95 }
);
assert.ok(scorerSystem().includes("0:"));
assert.ok(scorerSystem().includes("25:"));
assert.ok(scorerSystem().includes("50:"));
assert.ok(scorerSystem().includes("75:"));
assert.ok(scorerSystem().includes("100:"));

assert.deepStrictEqual(parseIssuesJson("not json"), []);
assert.deepStrictEqual(parseIssuesJson('{"issues":[]}'), []);
const parsed = parseIssuesJson(
  '```json\n{"issues":[{"path":"src/Foo.java","line":11,"summary":"npe","confidence":95}]}\n```'
);
assert.strictEqual(parsed.length, 1);
assert.strictEqual(parsed[0].confidence, 95);

const scored = applyConfidenceScores(
  [
    { path: "src/Foo.java", line: 11, summary: "npe", confidence: null },
    { path: "src/Bar.java", line: 4, summary: "ad", confidence: null },
  ],
  [
    { path: "src/Foo.java", line: 11, summary: "npe", confidence: 95 },
    { path: "src/Bar.java", line: 4, summary: "ad", confidence: 70 },
  ]
);
const kept = selectReviewIssues(scored);
assert.strictEqual(kept.length, 1, "70 elenmeli");
assert.strictEqual(kept[0].path, "src/Foo.java");
assert.strictEqual(severityForConfidence(95), "Critical");
assert.strictEqual(severityForConfidence(80), "Important");
assert.strictEqual(severityForConfidence(92, 99), "Important");
assert.strictEqual(severityForConfidence(99, 99), "Critical");

const duped = selectReviewIssues([
  { path: "src/Foo.java", line: 11, summary: "dusuk", confidence: 82 },
  { path: "src/Foo.java", line: 11, summary: "yuksek", confidence: 96 },
]);
assert.strictEqual(duped.length, 1);
assert.strictEqual(duped[0].summary, "yuksek");

const markdown = formatCodeReviewMarkdown([
  {
    path: "src/Foo.java",
    line: 11,
    summary: "null check yok",
    evidence: "NPE",
    confidence: 95,
  },
  {
    path: "src/Bar.java",
    line: 40,
    summary: "isim",
    evidence: "",
    confidence: 85,
  },
]);
assert.ok(markdown.includes("## Critical"));
assert.ok(markdown.includes("## Important"));
assert.ok(!markdown.includes("## Minor"));
assert.ok(markdown.includes("`src/Foo.java:11`"));

const diffData = {
  fromHash: "aaa",
  toHash: "bbb",
  diffs: [
    {
      source: { toString: "src/Foo.java" },
      destination: { toString: "src/Foo.java" },
      hunks: [
        {
          sourceLine: 10,
          destinationLine: 10,
          segments: [
            { type: "CONTEXT", lines: [{ line: "void x() {" }] },
            { type: "ADDED", lines: [{ line: "return null;" }] },
          ],
        },
      ],
    },
  ],
};
assert.strictEqual(hasReviewableDiff(diffData), true);
assert.strictEqual(hasReviewableDiff({ diffs: [] }), false);

const comments = resolveInlineComments(markdown, diffData, "qwen3");
assert.ok(comments.length >= 1, "Critical satir comment anchor uretmeli");
assert.strictEqual(comments[0].anchor.path, "src/Foo.java");
assert.ok(comments[0].text.includes("**Critical**"));

const paths = claudeMdPaths(["src/main/java/Foo.java"]);
assert.ok(paths.includes("CLAUDE.md"));
assert.ok(paths.includes("src/CLAUDE.md"));
assert.ok(paths.includes("src/main/CLAUDE.md"));
assert.ok(paths.includes("src/main/java/CLAUDE.md"));

assert.ok(extractCodeComments("int a;\n// tutma\n/* blok */\nvoid x() {}").includes("tutma"));

const ranges = blameRangesFromDiff(diffData);
assert.ok(ranges.length >= 1);
assert.strictEqual(ranges[0].path, "src/Foo.java");

async function run() {
  const calls = [];
  const result = await runCodeReview({
    cfg: {},
    diffData,
    repoPath: "",
    prDetails: { title: "Fee" },
    generateText: async (system) => {
      calls.push(system);
      if (system.startsWith("Score each candidate")) {
        return {
          label: "qwen",
          text: JSON.stringify({
            issues: [
              { path: "src/Foo.java", line: 11, summary: "null check yok", confidence: 92 },
            ],
          }),
        };
      }
      return {
        label: "qwen",
        text: JSON.stringify({
          issues: [
            { path: "src/Foo.java", line: 11, summary: "null check yok", kind: "bug" },
          ],
        }),
      };
    },
  });
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.issueCount, 1);
  assert.ok(result.reviewText.includes("## Critical"));
  assert.strictEqual(result.modelLabel, "qwen");
  assert.ok(calls.length >= 2, "uzman + confidence");

  const low = await runCodeReview({
    cfg: {},
    diffData,
    repoPath: "",
    prDetails: { title: "Fee" },
    generateText: async (system) => {
      if (system.startsWith("Score each candidate")) {
        return {
          label: "qwen",
          text: JSON.stringify({
            issues: [{ path: "src/Foo.java", line: 11, summary: "nit", confidence: 40 }],
          }),
        };
      }
      return {
        label: "qwen",
        text: JSON.stringify({
          issues: [{ path: "src/Foo.java", line: 11, summary: "nit", kind: "bug" }],
        }),
      };
    },
  });
  assert.strictEqual(low.issueCount, 0);
  assert.strictEqual(low.reviewText, "");

  const broken = await runCodeReview({
    cfg: {},
    diffData,
    repoPath: "",
    prDetails: { title: "Fee" },
    generateText: async () => ({ label: "qwen", text: "nope" }),
  });
  assert.strictEqual(broken.issueCount, 0);
  assert.strictEqual(broken.skipped, false);

  const empty = await runCodeReview({
    cfg: {},
    diffData: { diffs: [] },
    generateText: async () => {
      throw new Error("cagrilmamali");
    },
  });
  assert.strictEqual(empty.skipped, true);
  assert.strictEqual(empty.reason, "empty-diff");

  const raised = await runCodeReview({
    cfg: { codeReview: { minConfidence: 95, criticalMin: 99 } },
    diffData,
    repoPath: "",
    prDetails: { title: "Fee" },
    generateText: async (system) => {
      if (system.startsWith("Score each candidate")) {
        return {
          label: "qwen",
          text: JSON.stringify({
            issues: [{ path: "src/Foo.java", line: 11, summary: "null check yok", confidence: 92 }],
          }),
        };
      }
      return {
        label: "qwen",
        text: JSON.stringify({
          issues: [{ path: "src/Foo.java", line: 11, summary: "null check yok", kind: "bug" }],
        }),
      };
    },
  });
  assert.strictEqual(raised.issueCount, 0, "minConfidence 95, skor 92 elenmeli");

  const band = await runCodeReview({
    cfg: { codeReview: { minConfidence: 80, criticalMin: 99 } },
    diffData,
    repoPath: "",
    prDetails: { title: "Fee" },
    generateText: async (system) => {
      if (system.startsWith("Score each candidate")) {
        return {
          label: "qwen",
          text: JSON.stringify({
            issues: [{ path: "src/Foo.java", line: 11, summary: "null check yok", confidence: 92 }],
          }),
        };
      }
      return {
        label: "qwen",
        text: JSON.stringify({
          issues: [{ path: "src/Foo.java", line: 11, summary: "null check yok", kind: "bug" }],
        }),
      };
    },
  });
  assert.strictEqual(band.issueCount, 1);
  assert.ok(band.reviewText.includes("## Important"));
  assert.ok(!band.reviewText.includes("## Critical"));

  console.log("codeReviewRunner tests OK");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
