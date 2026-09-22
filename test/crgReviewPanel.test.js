"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { CRG_REVIEW_PRS_KEY } = require("../out/reviewedPrMemory");
const { CRG_REVIEW_COMMENT_MARKER } = require("../out/prComment");
const { buildBulkDevReviewHtml } = require("../out/prListViewHtml");
const { checkoutFeatureRef } = require("../out/gitBranchSync");

assert.strictEqual(CRG_REVIEW_PRS_KEY, "crgReviewPrKeys");
assert.strictEqual(
  CRG_REVIEW_COMMENT_MARKER,
  "ykb-pr-reviewer-extended-crg"
);
assert.ok(typeof checkoutFeatureRef === "function");

const labels = {
  searchLabel: "CRG Review — repo ara",
  loadButton: "PR'ları yükle (dev)",
  selectAll: "Tümünü seç (tekrar review)",
  runButton: (count) => `Seçili PR'larda CRG review (${count})`,
  stop: "Durdur",
  clear: "CRG comment'lerini sil + sayaç sıfırla",
  emptyRepos: "Repo ara",
  emptyPrs: "code-review-graph detect-changes --base origin/dev",
};
assert.ok(labels.runButton(2).includes("CRG"));

const html = buildBulkDevReviewHtml({
  nonce: "testnonce",
  ui: {
    fontSizePx: 12,
    buttonSizePx: 24,
    iconSizePx: 16,
    paddingPx: 8,
    gapPx: 4,
    radiusPx: 4,
  },
  query: "",
  repos: [],
  selectedRepos: [],
  prRows: [],
  reviewedKeys: [],
  statusText: "",
  busy: false,
  labels,
});
assert.ok(html.includes("CRG Review") || html.includes("CRG review"));
assert.ok(html.includes("code-review-graph") || html.includes("detect-changes"));

const providerSrc = fs.readFileSync(
  path.join(__dirname, "..", "out", "crgReviewWebviewProvider.js"),
  "utf8"
);
assert.ok(providerSrc.includes("crgReviewSelectedRepos"));
assert.ok(providerSrc.includes("CrgReviewWebviewProvider"));
assert.ok(providerSrc.includes("CRG Review — repo ara"));

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
assert.strictEqual(pkg.version, "1.7.16");
const views = pkg.contributes.views.ykbPrReviewerExtended;
assert.ok(
  views.some(
    (v) =>
      v.id === "ykbPrReviewerExtended.crgReview" &&
      v.name === "CRG Review" &&
      v.type === "webview"
  ),
  "CRG Review webview view olmali"
);
assert.ok(
  pkg.activationEvents.includes("onView:ykbPrReviewerExtended.crgReview"),
  "activationEvents crgReview icermeli"
);
assert.ok(
  pkg.contributes.commands.some(
    (cmd) => cmd.command === "ykbPrReviewerExtended.runCrgReview"
  ),
  "runCrgReview command olmali"
);
assert.ok(
  pkg.contributes.configuration.properties[
    "ykbPrReviewerExtended.crgReview.baseRef"
  ],
  "crgReview.baseRef setting olmali"
);
assert.strictEqual(
  pkg.contributes.configuration.properties[
    "ykbPrReviewerExtended.crgReview.baseRef"
  ].default,
  "origin/dev"
);

const extSrc = fs.readFileSync(
  path.join(__dirname, "..", "out", "extension.js"),
  "utf8"
);
assert.ok(extSrc.includes("runCrgReviewCycle"));
assert.ok(extSrc.includes("CRG_REVIEW_COMMENT_MARKER"));
assert.ok(extSrc.includes("crgReviewWebview"));
assert.ok(extSrc.includes("checkoutFeatureRef"));

console.log("crgReviewPanel tests OK");
