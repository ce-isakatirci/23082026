const assert = require("assert");
const path = require("path");
const {
  isReviewablePath,
  collectReviewFiles,
  formatFileDiff,
  packReviewChunks,
  buildChunkUserText,
  mergeChunkReviews,
  summarizeChunkFindings,
  buildPreviousChunksBridge,
} = require("../out/reviewPack");
const { readPromptConfig } = require("../out/promptConfig");

const promptDefaults = readPromptConfig({}, path.join(__dirname, ".."));
const CHUNK_REMINDER = promptDefaults.chunkReminder;

assert.strictEqual(isReviewablePath("src/Foo.java"), true);
assert.strictEqual(isReviewablePath("src/Foo.kt"), true);
assert.strictEqual(isReviewablePath("pom.xml"), true);
assert.strictEqual(isReviewablePath("module/pom.xml"), true);
assert.strictEqual(isReviewablePath("build.gradle"), true);
assert.strictEqual(isReviewablePath("package.json"), true);
assert.strictEqual(isReviewablePath("src/main/resources/application.yml"), true);
assert.strictEqual(isReviewablePath("src/main/resources/application-dev.properties"), true);
assert.strictEqual(isReviewablePath("web.xml"), true);
assert.strictEqual(isReviewablePath("mapper/OrderMapper.xml"), true);
assert.strictEqual(isReviewablePath("script/fix.sql"), true);
assert.strictEqual(isReviewablePath("src/app.ts"), true);
assert.strictEqual(isReviewablePath("src/app.js"), true);
assert.strictEqual(isReviewablePath("src/main/java/com/x/Contest.java"), true);

assert.strictEqual(isReviewablePath("package-lock.json"), false);
assert.strictEqual(isReviewablePath("yarn.lock"), false);
assert.strictEqual(isReviewablePath("config.json"), false);
assert.strictEqual(isReviewablePath("lib/foo.jar"), false);
assert.strictEqual(isReviewablePath("Foo.class"), false);
assert.strictEqual(isReviewablePath("docs/a.png"), false);
assert.strictEqual(isReviewablePath("docs/a.pdf"), false);
assert.strictEqual(
  isReviewablePath("node_modules/leftpad/index.js"),
  false
);
assert.strictEqual(isReviewablePath("service/target/Foo.java"), false);
assert.strictEqual(isReviewablePath("web/dist/app.js"), false);
assert.strictEqual(isReviewablePath(".git/HEAD"), false);
assert.strictEqual(isReviewablePath(".idea/workspace.xml"), false);

assert.strictEqual(
  isReviewablePath("src/test/java/com/x/FooTest.java"),
  false
);
assert.strictEqual(isReviewablePath("src/tests/Foo.java"), false);
assert.strictEqual(isReviewablePath("__tests__/foo.js"), false);
assert.strictEqual(isReviewablePath("src/main/java/com/x/FooTest.java"), false);
assert.strictEqual(isReviewablePath("src/main/java/com/x/FooTests.java"), false);
assert.strictEqual(isReviewablePath("src/FooTest.kt"), false);
assert.strictEqual(isReviewablePath("src/app.test.ts"), false);
assert.strictEqual(isReviewablePath("src/app.spec.js"), false);
assert.strictEqual(isReviewablePath("src/app_test.ts"), false);

function hunkDiff(path, line) {
  return {
    source: { toString: path },
    destination: { toString: path },
    hunks: [
      {
        sourceLine: 1,
        sourceSpan: 1,
        destinationLine: 1,
        destinationSpan: 1,
        segments: [{ type: "ADDED", lines: [{ line }] }],
      },
    ],
  };
}

const collected = collectReviewFiles({
  toHash: "abc",
  diffs: [
    hunkDiff("src/Foo.java", "return null;"),
    hunkDiff("package-lock.json", "{}"),
    hunkDiff("docs/logo.png", "binary"),
    {
      source: { toString: "src/Gone.java" },
      hunks: [
        {
          sourceLine: 1,
          sourceSpan: 1,
          destinationLine: 0,
          destinationSpan: 0,
          segments: [{ type: "REMOVED", lines: [{ line: "class Gone {}" }] }],
        },
      ],
    },
  ],
});
assert.deepStrictEqual(
  collected.map((f) => f.path),
  ["src/Foo.java", "src/Gone.java"]
);
assert.strictEqual(collected[0].deleted, false);
assert.strictEqual(collected[1].deleted, true);

const oneDiff = formatFileDiff(hunkDiff("src/Foo.java", "return null;"));
assert.ok(oneDiff.includes("src/Foo.java"));
assert.ok(oneDiff.includes("+ return null;"));

const packedOne = packReviewChunks(
  [
    {
      path: "src/Foo.java",
      deleted: false,
      diff: hunkDiff("src/Foo.java", "x();"),
      content: "class Foo { void x() {} }\n",
    },
  ],
  { maxPromptChars: 24000, maxFileChars: 12000, maxDiffChars: 18000 }
);
assert.strictEqual(packedOne.chunks.length, 1);
assert.strictEqual(packedOne.skippedPaths.length, 0);
assert.strictEqual(packedOne.chunks[0].files[0].truncated, false);
assert.ok(packedOne.chunks[0].files[0].content.includes("class Foo"));

const userText = buildChunkUserText({
  prId: "42",
  projectKey: "PAY",
  repoSlug: "payment-service",
  title: "Fix NPE",
  author: "Ada",
  fromBranch: "feature",
  toBranch: "main",
  description: "null check",
  chunk: packedOne.chunks[0],
  chunkIndex: 0,
  chunkCount: 1,
  prompt: promptDefaults,
});
assert.ok(userText.includes("PR ID"));
assert.ok(userText.includes("src/Foo.java"));
assert.ok(userText.includes("class Foo"));
assert.ok(userText.includes("```diff"));
assert.ok(userText.includes(CHUNK_REMINDER.trim()), "chunk reminder metni olmali");
assert.ok(userText.includes("Why it matters"), "label hatirlatmasi olmali");
assert.ok(userText.includes("#### Diff"), "Diff scope hatirlatmasi olmali");
assert.strictEqual(
  userText.indexOf(CHUNK_REMINDER.trim()),
  userText.lastIndexOf(CHUNK_REMINDER.trim()),
  "reminder yalnizca sonda bir kez"
);
assert.ok(
  userText.indexOf("#### Diff") < userText.indexOf(CHUNK_REMINDER.trim()),
  "Diff reminder'dan once"
);

const big = "A".repeat(500);
const packedSplit = packReviewChunks(
  [
    {
      path: "a.java",
      deleted: false,
      diff: hunkDiff("a.java", "a"),
      content: big,
    },
    {
      path: "b.java",
      deleted: false,
      diff: hunkDiff("b.java", "b"),
      content: big,
    },
  ],
  { maxPromptChars: 700, maxFileChars: 500, maxDiffChars: 200 }
);
assert.strictEqual(packedSplit.chunks.length, 2, "iki dosya iki chunk olmali");
assert.strictEqual(packedSplit.chunks[0].files[0].path, "a.java");
assert.strictEqual(packedSplit.chunks[1].files[0].path, "b.java");

const packedSingle = packReviewChunks(
  [
    {
      path: "a.java",
      deleted: false,
      diff: hunkDiff("a.java", "a"),
      content: big,
    },
    {
      path: "b.java",
      deleted: false,
      diff: hunkDiff("b.java", "b"),
      content: big,
    },
  ],
  {
    maxPromptChars: 700,
    maxFileChars: 500,
    maxDiffChars: 200,
    singleChunk: true,
  }
);
assert.strictEqual(
  packedSingle.chunks.length,
  1,
  "singleChunk: budget asilsa da tek chunk"
);
assert.strictEqual(packedSingle.skippedPaths.length, 0);
assert.ok(
  packedSingle.chunks[0].files.some((f) => f.path === "a.java")
);
assert.ok(
  packedSingle.chunks[0].files.some((f) => f.path === "b.java")
);

const huge = "B".repeat(4000);
const packedTrunc = packReviewChunks(
  [
    {
      path: "Huge.java",
      deleted: false,
      diff: hunkDiff("Huge.java", "z"),
      content: huge,
    },
  ],
  { maxPromptChars: 24000, maxFileChars: 100, maxDiffChars: 18000 }
);
assert.strictEqual(packedTrunc.chunks[0].files[0].truncated, true);
assert.strictEqual(packedTrunc.chunks[0].files[0].content.length, 100);
assert.ok(buildChunkUserText({
  prId: "1",
  projectKey: "P",
  repoSlug: "r",
  title: "t",
  author: "a",
  fromBranch: "f",
  toBranch: "t",
  description: "d",
  chunk: packedTrunc.chunks[0],
  chunkIndex: 0,
  chunkCount: 1,
  prompt: promptDefaults,
}).includes("truncated"));

const manyFiles = ["a", "b", "c", "d", "e", "f"].map((name) => ({
  path: `${name}.java`,
  deleted: false,
  diff: hunkDiff(`${name}.java`, name),
  content: name.toUpperCase().repeat(200),
}));
const packedAllParts = packReviewChunks(manyFiles, {
  maxPromptChars: 280,
  maxFileChars: 200,
  maxDiffChars: 50,
});
assert.strictEqual(
  packedAllParts.chunks.length,
  6,
  "chunk tavanı yüzünden dosya atlanmamali; gereken kadar parça açılmalı"
);
assert.deepStrictEqual(packedAllParts.skippedPaths, []);
assert.strictEqual(packedAllParts.chunks[5].files[0].path, "f.java");

const packedUnlimited = packReviewChunks(
  [
    {
      path: "a.java",
      deleted: false,
      diff: hunkDiff("a.java", "a"),
      content: "C".repeat(5000),
    },
    {
      path: "b.java",
      deleted: false,
      diff: hunkDiff("b.java", "b"),
      content: "D".repeat(5000),
    },
  ],
  { maxPromptChars: 0, maxFileChars: 0, maxDiffChars: 0 }
);
assert.strictEqual(
  packedUnlimited.chunks.length,
  1,
  "0 = sinirsiz: truncate/skip yok, tek chunk"
);
assert.deepStrictEqual(packedUnlimited.skippedPaths, []);
assert.strictEqual(packedUnlimited.chunks[0].files[0].content.length, 5000);
assert.strictEqual(packedUnlimited.chunks[0].files[1].content.length, 5000);

const deletedPacked = packReviewChunks(
  [
    {
      path: "src/Gone.java",
      deleted: true,
      diff: collected[1].diff,
      content: "",
    },
  ],
  { maxPromptChars: 24000, maxFileChars: 12000, maxDiffChars: 18000 }
);
const deletedUser = buildChunkUserText({
  prId: "1",
  projectKey: "P",
  repoSlug: "r",
  title: "t",
  author: "a",
  fromBranch: "f",
  toBranch: "t",
  description: "d",
  chunk: deletedPacked.chunks[0],
  chunkIndex: 0,
  chunkCount: 1,
  prompt: promptDefaults,
});
assert.ok(deletedUser.includes("src/Gone.java"));
// Silinen dosyada File içerik bölümü yok; reminder metnindeki `#### File` sayılmaz.
assert.ok(
  !deletedUser.includes("\n#### File\n"),
  "silinen dosyada #### File içerik basligi olmamali"
);

const singleKeep = mergeChunkReviews(["## Özet\ntek parça\n\n## Critical\n- npe\n"], {
  skippedPaths: [],
});
assert.ok(singleKeep.includes("tek parça"));
assert.ok(singleKeep.includes("## Critical"));

const merged = mergeChunkReviews(
  [
    "## Critical\n- `a.java:2` npe\n\n## Minor\n- naming\n",
    "## Important\n- tx boundary\n\n## Critical\n- `b.java:3` null\n",
  ],
  { skippedPaths: [] }
);
assert.ok(merged.includes("`a.java:2` npe"));
assert.ok(merged.includes("`b.java:3` null"));
assert.ok(merged.includes("tx boundary"));
assert.ok(merged.includes("naming"));
assert.ok(merged.includes("## Özet"));
assert.ok(merged.includes("Needs work"));
assert.ok(merged.includes("## Sonuç"));

const mergedSkip = mergeChunkReviews(["## Minor\n- style\n"], {
  skippedPaths: ["skip.java"],
});
assert.ok(mergedSkip.includes("skip.java"));
assert.ok(mergedSkip.includes("bütçe"));
assert.ok(mergedSkip.includes("Ready to merge"));
assert.ok(!mergedSkip.includes("Needs work"));

const relatedPacked = packReviewChunks(
  [
    {
      path: "src/i18n/tr.ts",
      role: "changed",
      deleted: false,
      diff: hunkDiff("src/i18n/tr.ts", "holdModal: {}"),
      content: "export default { holdModal: {} };\n",
    },
    {
      path: "src/components/Foo.tsx",
      role: "related",
      deleted: false,
      diff: null,
      content: "export const Foo = () => null;\n",
    },
  ],
  {
    maxPromptChars: 24000,
    maxFileChars: 12000,
    maxRelatedFileChars: 8000,
    maxDiffChars: 18000,
  }
);
const relatedUser = buildChunkUserText({
  prId: "99",
  projectKey: "COSSWIFT",
  repoSlug: "ui",
  title: "i18n",
  author: "dev",
  fromBranch: "feature",
  toBranch: "main",
  description: "hold modal",
  chunk: relatedPacked.chunks[0],
  chunkIndex: 0,
  chunkCount: 1,
  prompt: promptDefaults,
  unresolvedSymbols: ["holdModal"],
});
assert.ok(relatedUser.includes("src/components/Foo.tsx"));
assert.ok(relatedUser.includes("related context, read-only"));
assert.ok(relatedUser.includes("Unresolved symbols"));
assert.ok(relatedUser.includes("holdModal"));
assert.ok(
  !relatedUser.includes("src/components/Foo.tsx\n\n#### Diff"),
  "related dosyada Diff olmamali"
);

// Related, kendisini ceken changed ile ayni chunk'ta kalmali (orphan trailing yok).
const padA = "A".repeat(400);
const padB = "B".repeat(400);
const padRel = "R".repeat(80);
const colocated = packReviewChunks(
  [
    {
      path: "src/a/Service.java",
      role: "changed",
      deleted: false,
      diff: hunkDiff("src/a/Service.java", "service();"),
      content: padA,
    },
    {
      path: "src/b/Other.java",
      role: "changed",
      deleted: false,
      diff: hunkDiff("src/b/Other.java", "other();"),
      content: padB,
    },
    {
      path: "src/a/Helper.java",
      role: "related",
      deleted: false,
      diff: null,
      content: padRel,
      relatedTo: ["src/a/Service.java"],
    },
  ],
  {
    maxPromptChars: 700,
    maxFileChars: 400,
    maxRelatedFileChars: 80,
    maxDiffChars: 200,
  }
);
const colocatedPaths = colocated.chunks.map((c) => c.files.map((f) => f.path));
const serviceChunk = colocated.chunks.find((c) =>
  c.files.some((f) => f.path === "src/a/Service.java")
);
assert.ok(serviceChunk, "Service.java bir chunk'ta olmali");
assert.ok(
  serviceChunk.files.some((f) => f.path === "src/a/Helper.java"),
  "related Helper, Service ile ayni chunk'ta olmali; paths=" +
    JSON.stringify(colocatedPaths)
);
assert.ok(
  !colocated.chunks.some(
    (c) =>
      c.files.length === 1 && c.files[0].path === "src/a/Helper.java"
  ),
  "related tek basina orphan chunk olmamali"
);

const findingsMd =
  "## Critical\n- `a.java:1` npe risk\n\n## Important\n- tx\n\n## Minor\n- naming\n";
const summary = summarizeChunkFindings(findingsMd);
assert.ok(summary.includes("Critical"), "findings ozetinde Critical olmali");
assert.ok(
  summary.includes("`a.java:1`"),
  "Critical bridge path:line one-liner"
);
assert.ok(
  !summary.includes("npe risk"),
  "Critical why bridge'te tekrarlanmamali"
);
assert.ok(summary.includes("tx"), "Important bulgu metni tasimali");

const bridgeBlock = buildPreviousChunksBridge({
  filePaths: ["src/a/Service.java", "src/a/Helper.java"],
  findingsSummary: summary,
  unresolvedSymbols: ["holdModal"],
});
assert.ok(bridgeBlock.includes("Previous chunks"), "bridge basligi olmali");
assert.ok(
  bridgeBlock.includes("yeniden Critical yapma") ||
    bridgeBlock.includes("tekrar yazma"),
  "bridge no-repeat Critical uyarisi"
);
assert.ok(bridgeBlock.includes("src/a/Service.java"));
assert.ok(bridgeBlock.includes("holdModal"));

const bridgedUser = buildChunkUserText({
  prId: "7",
  projectKey: "PAY",
  repoSlug: "svc",
  title: "chunk2",
  author: "dev",
  fromBranch: "f",
  toBranch: "t",
  description: "d",
  chunk: packedOne.chunks[0],
  chunkIndex: 1,
  chunkCount: 2,
  prompt: promptDefaults,
  unresolvedSymbols: [],
  previousChunksBridge: {
    filePaths: ["src/a/Service.java"],
    findingsSummary: summary,
    unresolvedSymbols: ["holdModal"],
  },
});
assert.ok(
  bridgedUser.includes("Previous chunks"),
  "chunk i>0 user text bridge icermeli"
);
assert.ok(bridgedUser.includes("src/a/Service.java"));
assert.ok(
  bridgedUser.includes("`a.java:1`"),
  "bridge Critical path:line one-liner"
);
assert.ok(
  !bridgedUser.includes("npe risk"),
  "Critical why bridge'te olmamali"
);
assert.ok(
  bridgedUser.indexOf("#### Diff") < bridgedUser.indexOf("Previous chunks"),
  "Diff, previous-chunks bridge'den once gelmeli (lost-in-the-middle)"
);
assert.ok(
  relatedUser.indexOf("#### Diff") <
    relatedUser.indexOf("related context, read-only"),
  "changed Diff, related body'den once"
);

const mergeDedupe = mergeChunkReviews(
  [
    [
      "## Critical",
      "**File:** `src/a/Foo.java:120`",
      "**Issue:** TOCTOU race",
      "**Why it matters:** two threads",
      "",
    ].join("\n"),
    [
      "## Important",
      "**File:** `src/a/Foo.java:120`",
      "**Issue:** N+1 findBy",
      "**Why it matters:** perf",
      "",
    ].join("\n"),
  ],
  { skippedPaths: [] }
);
const fooMentions = mergeDedupe.split("Foo.java:120").length - 1;
assert.strictEqual(fooMentions, 1, "merge path:line unique");
assert.ok(/TOCTOU/i.test(mergeDedupe), "yüksek severity kalır");
assert.ok(!/N\+1 findBy/i.test(mergeDedupe), "aynı satır Important düşer");

const inquiryPacked = packReviewChunks(
  [
    {
      path: "src/main/java/com/ykb/nl/sepa/web/DummyOther.java",
      role: "changed",
      deleted: false,
      diff: hunkDiff(
        "src/main/java/com/ykb/nl/sepa/web/DummyOther.java",
        "class DummyOther {}"
      ),
      content: "class DummyOther {}\n".repeat(40),
    },
    {
      path: "src/main/java/com/ykb/nl/sepa/service/messageinquiry/MessageInquiryService.java",
      role: "changed",
      deleted: false,
      diff: hunkDiff(
        "src/main/java/com/ykb/nl/sepa/service/messageinquiry/MessageInquiryService.java",
        "searchIncoming"
      ),
      content: "class MessageInquiryService { void searchIncoming() {} }\n",
    },
    {
      path: "src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java",
      role: "changed",
      deleted: false,
      diff: hunkDiff(
        "src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java",
        "orphanRemoval = true"
      ),
      content: "@Lob private String xmlData;\n@OneToMany(orphanRemoval = true)\n",
    },
    {
      path: "src/main/java/com/ykb/nl/sepa/dao/entity/OutgoingMessageMasterEntity.java",
      role: "related",
      deleted: false,
      diff: null,
      content: "@Lob private String xmlData;\n",
      relatedTo: [
        "src/main/java/com/ykb/nl/sepa/service/messageinquiry/MessageInquiryService.java",
      ],
    },
  ],
  {
    maxPromptChars: 220,
    maxFileChars: 200,
    maxRelatedFileChars: 200,
    maxDiffChars: 200,
  }
);
const inquiryServiceChunk = inquiryPacked.chunks.find((chunk) =>
  (chunk.files || []).some((f) =>
    String(f.path || "").includes("MessageInquiryService.java")
  )
);
assert.ok(inquiryServiceChunk, "inquiry service chunk");
assert.ok(
  inquiryServiceChunk.files.some((f) =>
    String(f.path || "").includes("IncomingMessageMasterEntity.java")
  ),
  "incoming entity same chunk as service"
);
assert.ok(
  inquiryServiceChunk.files.some((f) =>
    String(f.path || "").includes("OutgoingMessageMasterEntity.java")
  ),
  "outgoing entity related same chunk"
);
assert.ok(
  !inquiryPacked.chunks.some((chunk) =>
    (chunk.files || []).some((f) =>
      String(f.path || "").includes("batch/sepaincoming")
    )
  ),
  "related batch parser yok"
);

console.log("reviewPack tests OK");
