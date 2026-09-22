"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  scoreRelatedPath,
  buildRelatedFiles,
  markChangedFiles,
  resolveRelatedPaths,
  filterRelatedByDenylist,
} = require("../../out/contextExpansion/relatedResolver");

const score = scoreRelatedPath(
  "src/components/HoldModal.tsx",
  ["src/i18n/tr.ts"],
  "holdModal"
);
assert.ok(score >= 1);

const changed = markChangedFiles([{ path: "src/a.ts", diff: {} }]);
assert.strictEqual(changed[0].role, "changed");

const inquiryChanged = [
  "src/main/java/com/ykb/nl/sepa/web/MessageInquiryController.java",
];
const pairs = [
  {
    path: "src/main/java/com/ykb/nl/sepa/batch/sepaincoming/parse/service/CommonParserServiceImpl.java",
    symbol: "fill",
  },
  {
    path: "src/main/java/com/ykb/nl/sepa/service/messageinquiry/XmlContentResolver.java",
    symbol: "resolve",
  },
];
const filtered = filterRelatedByDenylist(pairs, inquiryChanged, [
  "batch/sepaincoming",
  "batch/instantpayments",
]);
assert.strictEqual(filtered.length, 1);
assert.ok(filtered[0].path.includes("XmlContentResolver"));

const noInquiry = filterRelatedByDenylist(
  pairs,
  ["src/main/java/com/ykb/nl/sepa/batch/sepaincoming/parse/parsers/IncomingCTPSParser.java"],
  ["batch/sepaincoming"]
);
assert.strictEqual(noInquiry.length, 2, "inquiry yoksa denylist related kesmez");

const tmpDir = path.join(__dirname, ".tmp-related");
fs.mkdirSync(tmpDir, { recursive: true });
const samplePath = path.join(tmpDir, "src", "Foo.ts");
fs.mkdirSync(path.dirname(samplePath), { recursive: true });
fs.writeFileSync(samplePath, "export const x = 1;\n", "utf8");

const related = buildRelatedFiles(tmpDir, ["src/Foo.ts"]);
assert.strictEqual(related.length, 1);
assert.strictEqual(related[0].role, "related");
assert.ok(related[0].content.includes("export const x"));
assert.deepStrictEqual(related[0].relatedTo, []);

const relatedWithMeta = buildRelatedFiles(tmpDir, [
  { path: "src/Foo.ts", relatedTo: ["src/i18n/tr.ts"] },
]);
assert.strictEqual(relatedWithMeta.length, 1);
assert.deepStrictEqual(relatedWithMeta[0].relatedTo, ["src/i18n/tr.ts"]);

(async () => {
  // codegraph init/sync fail → throw (diff-only soft-fail yok)
  await assert.rejects(
    () =>
      resolveRelatedPaths({
        repoPath: tmpDir,
        symbols: ["holdModal"],
        changedPaths: [{ path: "src/i18n/tr.ts" }],
        contextExpansion: {
          codegraphTimeoutMs: 5000,
          maxRelatedFiles: 8,
          deniedPathSegments: ["node_modules"],
        },
        execFileImpl: (_cmd, _args, _opts, cb) => {
          cb(new Error("codegraph missing"), "", "not found");
        },
      }),
    (err) => /codegraph/i.test(String(err && err.message))
  );

  console.log("relatedResolver tests OK");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
