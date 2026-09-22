"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { OCR_REVIEW_PRS_KEY } = require("../out/reviewedPrMemory");
const { OCR_REVIEW_COMMENT_MARKER } = require("../out/prComment");
const { buildBulkDevReviewHtml } = require("../out/prListViewHtml");
const {
  toOriginRef,
  resolveToRef,
  resolveFromBranchDisplay,
} = require("../out/gitBranchSync");

assert.strictEqual(OCR_REVIEW_PRS_KEY, "ocrReviewPrKeys");
assert.strictEqual(
  OCR_REVIEW_COMMENT_MARKER,
  "ykb-pr-reviewer-extended-ocr"
);

assert.strictEqual(toOriginRef("feature/foo"), "origin/feature/foo");
assert.strictEqual(toOriginRef("origin/feature/foo"), "origin/feature/foo");
assert.strictEqual(toOriginRef("refs/heads/bar"), "origin/bar");
assert.strictEqual(
  resolveToRef({ fromRef: { displayId: "feature/x" } }),
  "origin/feature/x"
);
assert.strictEqual(resolveToRef({ fromRef: { displayId: "" } }), "");
assert.strictEqual(
  resolveFromBranchDisplay({ toRef: { displayId: "origin/dev" } }),
  "dev"
);

const labels = {
  searchLabel: "OCR Review — repo ara",
  loadButton: "PR'ları yükle (dev)",
  selectAll: "Tümünü seç (tekrar review)",
  runButton: (count) => `Seçili PR'larda OCR review (${count})`,
  stop: "Durdur",
  clear: "OCR comment'lerini sil + sayaç sıfırla",
  emptyRepos: "Repo ara",
  emptyPrs: "ocr review --from origin/dev --to origin/&lt;branch&gt;",
};
assert.ok(labels.runButton(2).includes("OCR"));

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
assert.ok(html.includes("OCR Review") || html.includes("OCR review"));
assert.ok(html.includes("ocr review"));

const providerSrc = fs.readFileSync(
  path.join(__dirname, "..", "out", "ocrReviewWebviewProvider.js"),
  "utf8"
);
assert.ok(providerSrc.includes("ocrReviewSelectedRepos"));
assert.ok(providerSrc.includes("OcrReviewWebviewProvider"));
assert.ok(providerSrc.includes("OCR Review — repo ara"));

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const views = pkg.contributes.views.ykbPrReviewerExtended;
assert.ok(
  views.some(
    (v) =>
      v.id === "ykbPrReviewerExtended.ocrReview" &&
      v.name === "OCR Review" &&
      v.type === "webview"
  ),
  "OCR Review webview view olmali"
);
assert.ok(
  pkg.activationEvents.includes("onView:ykbPrReviewerExtended.ocrReview"),
  "activationEvents ocrReview icermeli"
);
assert.ok(
  pkg.contributes.commands.some(
    (cmd) => cmd.command === "ykbPrReviewerExtended.runOcrReview"
  ),
  "runOcrReview command olmali"
);
assert.ok(
  pkg.contributes.configuration.properties[
    "ykbPrReviewerExtended.ocrReview.baseRef"
  ],
  "ocrReview.baseRef setting olmali"
);
assert.strictEqual(
  pkg.contributes.configuration.properties[
    "ykbPrReviewerExtended.ocrReview.baseRef"
  ].default,
  "origin/dev"
);

const extSrc = fs.readFileSync(
  path.join(__dirname, "..", "out", "extension.js"),
  "utf8"
);
assert.ok(extSrc.includes("runOcrReviewCycle"));
assert.ok(extSrc.includes("OCR_REVIEW_COMMENT_MARKER"));
assert.ok(extSrc.includes("ocrReviewWebview"));

console.log("ocrReviewPanel tests OK");
