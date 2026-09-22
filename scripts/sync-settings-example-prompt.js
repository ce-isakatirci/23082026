"use strict";

/**
 * settings.example.json prompt path/flag alanlarını prompt/defaults.json ile hizalar.
 * Uzun metin yazılmaz — yalnızca files.* path'leri.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaults = JSON.parse(
  fs.readFileSync(path.join(root, "prompt", "defaults.json"), "utf8")
);
const examplePath = path.join(root, "settings.example.json");
const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));

const keepPrefixes = [
  "ykbPrReviewerExtended.baseUrl",
  "ykbPrReviewerExtended.token",
  "ykbPrReviewerExtended.model",
  "ykbPrReviewerExtended.aiIdeAssistant.use",
  "ykbPrReviewerExtended.extraInstructions",
  "ykbPrReviewerExtended.javaHome",
  "ykbPrReviewerExtended.npmPath",
  "ykbPrReviewerExtended.maxDiffChars",
  "ykbPrReviewerExtended.maxPromptChars",
  "ykbPrReviewerExtended.maxFileChars",
  "ykbPrReviewerExtended.codeReview.minConfidence",
  "ykbPrReviewerExtended.codeReview.criticalMin",
  "ykbPrReviewerExtended.ocrReview.executablePath",
  "ykbPrReviewerExtended.ocrReview.baseRef",
  "ykbPrReviewerExtended.ocrReview.timeoutMinutes",
  "ykbPrReviewerExtended.ocrReview.audience",
  "ykbPrReviewerExtended.crgReview.executablePath",
  "ykbPrReviewerExtended.crgReview.baseRef",
  "ykbPrReviewerExtended.crgReview.timeoutMinutes",
  "ykbPrReviewerExtended.crgReview.maxContextChars",
  "ykbPrReviewerExtended.prAgentReview.executablePath",
  "ykbPrReviewerExtended.prAgentReview.baseRef",
  "ykbPrReviewerExtended.prAgentReview.timeoutMinutes",
  "ykbPrReviewerExtended.contextExpansion.enabled",
  "ykbPrReviewerExtended.contextExpansion.cacheRoot",
  "ykbPrReviewerExtended.contextExpansion.maxRelatedFiles",
  "ykbPrReviewerExtended.contextExpansion.maxRelatedFileChars",
  "ykbPrReviewerExtended.contextExpansion.codegraphTimeoutMs",
  "ykbPrReviewerExtended.contextExpansion.onNoInRepoConsumer",
  "ykbPrReviewerExtended.contextExpansion.deniedPathSegments",
  "ykbPrReviewerExtended.openPreview",
  "ykbPrReviewerExtended.autoReview.enabled",
  "ykbPrReviewerExtended.autoReview.intervalMinutes",
  "ai-ide-assistant.maxIterations",
  "ai-ide-assistant.providers",
];

const out = {};
for (const k of keepPrefixes) {
  if (example[k] !== undefined) out[k] = example[k];
}

out["ykbPrReviewerExtended.prompt.temperature"] = defaults.temperature;
out["ykbPrReviewerExtended.prompt.systemRole"] = defaults.systemRole;
out["ykbPrReviewerExtended.prompt.userRole"] = defaults.userRole;
out["ykbPrReviewerExtended.prompt.filesRoot"] = defaults.filesRoot || "";

const includes = [
  "includeSkills",
  "includeSkillsOnFindingsOnly",
  "compactFindingsOnly",
  "includeLanguageRule",
  "includeScopeRule",
  "includeContextExpansionRule",
  "includeYkbDomainRules",
  "includeExtraInstructions",
  "includeEnvironment",
  "includeOutputFormat",
  "includeChunkReminder",
  "includeFileContents",
];
for (const k of includes) {
  out[`ykbPrReviewerExtended.prompt.${k}`] = defaults[k];
}

for (const [k, rel] of Object.entries(defaults.files || {})) {
  out[`ykbPrReviewerExtended.prompt.files.${k}`] = rel;
}

out["ykbPrReviewerExtended.prompt.systemPreamble"] =
  defaults.systemPreamble || "";
out["ykbPrReviewerExtended.prompt.systemEpilogue"] =
  defaults.systemEpilogue || "";

for (const k of [
  "ui.fontSizePx",
  "ui.buttonSizePx",
  "ui.iconSizePx",
  "ui.paddingPx",
  "ui.gapPx",
  "ui.radiusPx",
]) {
  const full = `ykbPrReviewerExtended.${k}`;
  if (example[full] !== undefined) out[full] = example[full];
}

fs.writeFileSync(examplePath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log("synced slim settings.example.json");
