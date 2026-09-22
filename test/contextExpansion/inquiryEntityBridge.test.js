"use strict";

const assert = require("assert");
const {
  inquiryOwnerPath,
  extractMappingSnippet,
  buildInquiryEntityRelated,
  mergeInquiryRelatedFiles,
  SNIPPET_MAX_LINES,
} = require("../../out/contextExpansion/inquiryEntityBridge");

assert.ok(
  inquiryOwnerPath([
    "src/main/java/com/ykb/nl/sepa/service/messageinquiry/MessageInquiryService.java",
  ]).includes("MessageInquiryService")
);
assert.strictEqual(inquiryOwnerPath(["src/other/Foo.java"]), null);

const lines = [];
for (let i = 1; i <= 120; i++) {
  if (i === 56) lines.push("    @Lob");
  else if (i === 57) lines.push("    private String xmlData;");
  else if (i === 86) lines.push("    @OneToMany(fetch = FetchType.EAGER, orphanRemoval = true)");
  else if (i === 87) lines.push("    private List incomingMessages;");
  else lines.push("    // pad " + i);
}
const snippet = extractMappingSnippet(lines.join("\n"), SNIPPET_MAX_LINES);
assert.ok(/@Lob/.test(snippet), "snippet xmlData/Lob kapsar");
assert.ok(/orphanRemoval/.test(snippet), "snippet orphanRemoval kapsar");
assert.ok(
  snippet.split(/\n/).length <= SNIPPET_MAX_LINES,
  "snippet max 80 satir"
);

const files = {
  "src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java":
    "@Lob\nprivate String xmlData;\n",
  "src/main/java/com/ykb/nl/sepa/dao/entity/OutgoingMessageMasterEntity.java":
    "@Lob\nprivate String xmlData;\n",
};

const related = buildInquiryEntityRelated(
  "/repo",
  [
    "src/main/java/com/ykb/nl/sepa/service/messageinquiry/MessageInquiryService.java",
  ],
  (_repo, filePath) => files[filePath] || null
);
assert.strictEqual(related.length, 2);
assert.ok(related.every((f) => f.role === "related"));
assert.ok(
  related.every((f) =>
    f.relatedTo.includes(
      "src/main/java/com/ykb/nl/sepa/service/messageinquiry/MessageInquiryService.java"
    )
  )
);

const skipChanged = buildInquiryEntityRelated(
  "/repo",
  [
    "src/main/java/com/ykb/nl/sepa/service/messageinquiry/MessageInquiryService.java",
    "src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java",
  ],
  (_repo, filePath) => files[filePath] || null
);
assert.strictEqual(skipChanged.length, 1);
assert.ok(skipChanged[0].path.includes("OutgoingMessageMasterEntity"));

const merged = mergeInquiryRelatedFiles(
  [{ path: skipChanged[0].path, role: "related" }],
  skipChanged
);
assert.strictEqual(merged.length, 1, "duplicate related yok");

console.log("inquiryEntityBridge tests OK");
