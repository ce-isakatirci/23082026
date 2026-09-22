const assert = require("assert");
const path = require("path");
const {
  loadPromptDefaults,
  clearPromptDefaultsCache,
  readPromptConfig,
  buildAssistantPrompt,
  extractSeverityMap,
  outputLock,
} = require("../out/promptConfig");
const { buildChunkUserText } = require("../out/reviewPack");

const root = path.join(__dirname, "..");
clearPromptDefaultsCache();
const defaults = loadPromptDefaults(root);
assert.ok(defaults.files.languageRule);
assert.ok(!defaults.languageRule, "uzun metin defaults.json icinde olmamali");

const fromEmpty = readPromptConfig({}, root);
assert.ok(fromEmpty.languageRule.includes("**File:**"));
assert.ok(fromEmpty.ykbDomainRules.includes("BREAKING CHANGE"));
assert.ok(fromEmpty.ykbDomainRules.includes("SEVERITY GATE"));
assert.ok(fromEmpty.skillUsingSuperpowers.includes("Diff-first"));
assert.ok(fromEmpty.skillsIntro.includes("requesting-code-review"));
assert.ok(!fromEmpty.skillsIntro.includes("Using skill: using-superpowers"));
assert.ok(fromEmpty.outputFormat.includes("Severity map"));
assert.ok(fromEmpty.findingsOnlyFormat.includes("**File:**"));
assert.ok(fromEmpty.skillReviewerTemplate.includes("ÇIKTI KİLİDİ"));
assert.ok(!fromEmpty.skillReviewerTemplate.includes("### Strengths"));
assert.ok(!fromEmpty.skillReviewerTemplate.includes("#### Critical"));
assert.strictEqual(fromEmpty.temperature, 0.2);
assert.strictEqual(fromEmpty.includeSkills, true);
assert.strictEqual(fromEmpty.includeSkillsOnFindingsOnly, false);
assert.strictEqual(fromEmpty.compactFindingsOnly, true);
assert.strictEqual(fromEmpty.includeEnvironment, false);
assert.ok(fromEmpty.systemPreamble.includes("Diff-first"));
assert.ok(fromEmpty.localBroadReview.includes("CodeGraph"));
assert.strictEqual(fromEmpty.resolvedFiles.languageRule.source, "extension");

const map = extractSeverityMap(fromEmpty.outputFormat);
assert.ok(map.includes("**Critical:**"));
assert.ok(map.includes("**Important:**"));
assert.ok(map.includes("**Minor:**"));

const full = buildAssistantPrompt(
  { extraInstructions: "NPE bak", javaHome: "C:/jdk", prompt: { ...fromEmpty } },
  null,
  { findingsOnly: false }
);
assert.ok(full.includes("NPE bak"));
assert.ok(full.includes("ÇIKTI KİLİDİ"));
assert.ok(full.includes("## Critical"));
assert.ok(
  full.lastIndexOf("## Critical") > full.indexOf("**Severity map:**"),
  "merge heading kilidi severity map'ten sonra (recency)"
);
assert.ok(!full.includes("JAVA_HOME"), "environment default kapali");

const findings = buildAssistantPrompt(
  { extraInstructions: "", prompt: { ...fromEmpty } },
  null,
  { findingsOnly: true }
);
assert.ok(findings.includes("**Severity map:**"), "chunk prompt tek map'i kaybetmesin");
assert.ok(findings.includes("Özet / Güçlü yönler / Sonuç yazma"));
assert.ok(findings.includes(outputLock(true).slice(0, 20)));
assert.ok(
  !findings.includes("REVIEWER TEMPLATE"),
  "findings-only default skills kapali"
);
assert.ok(
  findings.includes("ANTI-HALLUCINATION") || findings.includes("INQUIRY"),
  "findings-only domain card kalsin"
);

const lockOff = buildAssistantPrompt(
  {
      extraInstructions: "UNIQUE_EXTRA_TOKEN",
    prompt: {
      ...fromEmpty,
      includeSkills: false,
      includeLanguageRule: false,
      includeScopeRule: false,
      includeContextExpansionRule: false,
      includeYkbDomainRules: false,
      includeExtraInstructions: false,
      includeEnvironment: false,
      includeOutputFormat: false,
      closingNotes: "",
      findingsOnlyChunkNote: "",
      systemPreamble: "HELLO",
      systemEpilogue: "BYE",
    },
  },
  null,
  { findingsOnly: false }
);
assert.ok(lockOff.includes("HELLO"));
assert.ok(lockOff.includes("BYE"));
assert.ok(lockOff.includes("## Critical"), "format kilidi includeOutputFormat false olsa da durur");
assert.ok(!lockOff.includes("UNIQUE_EXTRA_TOKEN"), "extraInstructions flag kapaliysa eklenmez");

const packed = {
  files: [
    {
      path: "src/Foo.java",
      deleted: false,
      diffText: "### src/Foo.java\n+ x",
      content: "class Foo {}",
      truncated: false,
    },
  ],
};
const withFile = buildChunkUserText({
  prId: "1",
  projectKey: "P",
  repoSlug: "r",
  title: "t",
  author: "a",
  fromBranch: "f",
  toBranch: "m",
  description: "d",
  chunk: packed,
  chunkIndex: 0,
  chunkCount: 1,
  prompt: fromEmpty,
});
assert.ok(withFile.includes("#### File"));
assert.ok(withFile.includes("#### Diff"));
assert.ok(
  withFile.indexOf("#### Diff") < withFile.indexOf("HATIRLATMA"),
  "reminder Diff'ten sonra"
);
assert.ok(
  withFile.indexOf("HATIRLATMA") === withFile.lastIndexOf("HATIRLATMA"),
  "reminder yalnizca sonda"
);

const noFile = buildChunkUserText({
  prId: "1",
  projectKey: "P",
  repoSlug: "r",
  title: "t",
  author: "a",
  fromBranch: "f",
  toBranch: "m",
  description: "d",
  chunk: packed,
  chunkIndex: 0,
  chunkCount: 1,
  prompt: {
    ...fromEmpty,
    includeFileContents: false,
    includeChunkReminder: false,
  },
});
assert.ok(!noFile.includes("#### File"));
assert.ok(!noFile.includes("HATIRLATMA"));

const compact = buildAssistantPrompt(
  { extraInstructions: "NPE bak", prompt: { ...fromEmpty } },
  null,
  { findingsOnly: true, compactRules: true }
);
assert.ok(compact.includes("**Severity map:**"));
assert.ok(compact.includes("**Critical:**"));
assert.ok(
  !compact.includes("BREAKING CHANGE"),
  "compact i>0 SEVERITY GATE essay yok"
);
assert.ok(
  !compact.includes("ANTI-HALLUCINATION"),
  "compact ykb-domain tekrar yok"
);
assert.ok(compact.includes("Önceki chunk bulgusunu kopyalama"));
assert.ok(
  compact.length <= 1600,
  "compact kural gövdesi ~1.2KB (lock dahil tavan 1600)"
);

const localBroadFindings = buildAssistantPrompt(
  { extraInstructions: "", prompt: { ...fromEmpty } },
  null,
  { findingsOnly: true, localBroadReview: true }
);
assert.ok(
  localBroadFindings.includes("LOCAL BROAD REVIEW"),
  "local broad block findings chunk'ta"
);
assert.ok(
  localBroadFindings.includes("REVIEWER TEMPLATE"),
  "local broad findings chunk skills acik"
);

const localBroadCompact = buildAssistantPrompt(
  { extraInstructions: "", prompt: { ...fromEmpty } },
  null,
  { findingsOnly: true, compactRules: true, localBroadReview: true }
);
assert.ok(
  localBroadCompact.includes("REVIEWER TEMPLATE"),
  "local broad compactRules skill siyirmaz"
);
assert.ok(
  localBroadCompact.includes("LOCAL BROAD REVIEW"),
  "local broad compactRules tam prompt"
);

console.log("promptConfig tests OK");
