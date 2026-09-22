const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { DEFAULT_UI_PX, normalizeUiPx } = require("../out/uiSettings");
const { buildPrListHtml, PR_LIST_CSS } = require("../out/prListViewHtml");

assert.strictEqual(DEFAULT_UI_PX.fontSizePx, 12);
assert.strictEqual(normalizeUiPx().fontSizePx, 12);
assert.strictEqual(normalizeUiPx({}).buttonSizePx, 24);
assert.strictEqual(normalizeUiPx({ fontSizePx: 18 }).fontSizePx, 18);
assert.strictEqual(normalizeUiPx({ fontSizePx: 3 }).fontSizePx, 8);
assert.strictEqual(normalizeUiPx({ fontSizePx: "x" }).fontSizePx, 12);

const example = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "settings.example.json"),
    "utf8"
  )
);
assert.strictEqual(example["ykbPrReviewerExtended.ui.fontSizePx"], 12);
assert.strictEqual(example["ykbPrReviewerExtended.ui.buttonSizePx"], 24);
assert.strictEqual(example["ykbPrReviewerExtended.ui.iconSizePx"], 16);
assert.strictEqual(example["ykbPrReviewerExtended.ui.paddingPx"], 8);
assert.strictEqual(example["ykbPrReviewerExtended.ui.gapPx"], 4);
assert.strictEqual(example["ykbPrReviewerExtended.ui.radiusPx"], 4);
assert.strictEqual(example["ykbPrReviewerExtended.maxDiffChars"], 8000);
assert.strictEqual(example["ykbPrReviewerExtended.maxPromptChars"], 12000);
assert.strictEqual(example["ykbPrReviewerExtended.maxFileChars"], 2500);
assert.strictEqual(
  example["ykbPrReviewerExtended.maxReviewChunks"],
  undefined,
  "maxReviewChunks kalkmali; dosya atlama yok"
);
assert.strictEqual(
  typeof example["ykbPrReviewerExtended.extraInstructions"],
  "string",
  "extraInstructions settings.example.json içinde string olmalı"
);
assert.strictEqual(example["ykbPrReviewerExtended.model"], "gpt-5.4-mini");
assert.strictEqual(example["ykbPrReviewerExtended.prompt.temperature"], 0.2);
assert.strictEqual(example["ykbPrReviewerExtended.prompt.includeSkills"], true);
assert.strictEqual(
  example["ykbPrReviewerExtended.prompt.includeEnvironment"],
  false
);
assert.strictEqual(
  example["ykbPrReviewerExtended.prompt.includeFileContents"],
  true
);
assert.strictEqual(
  example["ykbPrReviewerExtended.prompt.files.languageRule"],
  "prompt/language-rule.md"
);
assert.strictEqual(
  example["ykbPrReviewerExtended.prompt.files.ykbDomainRules"],
  "prompt/ykb-domain-rules.md"
);
assert.strictEqual(
  example["ykbPrReviewerExtended.prompt.skillUsingSuperpowers"],
  undefined,
  "uzun skill metni settings.example.json icinde olmamali"
);

assert.ok(PR_LIST_CSS.includes("var(--ui-font)"));
assert.ok(PR_LIST_CSS.includes("var(--ui-button)"));

const html = buildPrListHtml({ nonce: "n", rows: [] });
assert.ok(html.includes("--ui-font: 12px"));
assert.ok(html.includes("--ui-button: 24px"));
assert.ok(html.includes("--ui-icon: 16px"));

const custom = buildPrListHtml({
  nonce: "n",
  rows: [],
  ui: { fontSizePx: 18, buttonSizePx: 40, iconSizePx: 22 },
});
assert.ok(custom.includes("--ui-font: 18px"));
assert.ok(custom.includes("--ui-button: 40px"));
assert.ok(custom.includes("--ui-icon: 22px"));
assert.ok(!custom.includes("--ui-font: 12px"));

console.log("uiSettings tests OK");
