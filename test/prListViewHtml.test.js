const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  PR_LIST_CSS,
  buildPrListHtml,
  buildSettingsHtml,
  buildBulkDevReviewHtml,
  escapeHtml,
  reviewBadgeHtml,
} = require("../out/prListViewHtml");

assert.ok(PR_LIST_CSS.includes("var(--ui-font)"));
assert.ok(PR_LIST_CSS.includes("Segoe UI"));
assert.ok(PR_LIST_CSS.includes("Tahoma"));
assert.ok(PR_LIST_CSS.includes("#ffcdd2") || PR_LIST_CSS.includes("255, 82, 82"));
assert.ok(PR_LIST_CSS.includes(".pr-row.reviewed"));
assert.ok(PR_LIST_CSS.includes(".pr-review-badge"));
assert.ok(PR_LIST_CSS.includes("var(--ui-button)"));

assert.ok(reviewBadgeHtml(0) === "");
assert.ok(reviewBadgeHtml(3).includes("3"));
assert.ok(reviewBadgeHtml(3).includes("pr-review-badge"));
assert.ok(reviewBadgeHtml(150).includes("99+"));

assert.strictEqual(escapeHtml("<script>"), "&lt;script&gt;");

const html = buildPrListHtml({
  nonce: "testnonce",
  selectedKey: "PAY/payment-service/42",
  reviewedKeys: ["PAY/payment-service/42"],
  reviewCounts: { "PAY/payment-service/42": 3 },
  message: null,
  rows: [
    {
      projectKey: "PAY",
      repoSlug: "payment-service",
      prId: "42",
      title: "Fix <NPE>",
      description: "feature/pay → main",
      author: "Ada",
      status: "UNAPPROVED",
      approvedCount: 1,
      reviewerCount: 2,
    },
  ],
});

assert.ok(html.includes("--ui-font: 12px"));
assert.ok(html.includes("Segoe UI"));
assert.ok(html.includes('class="pr-row reviewed selected"'));
assert.ok(html.includes('class="pr-review-badge"'));
assert.ok(html.includes(">3<"));
assert.ok(html.includes("Fix &lt;NPE&gt;"));
assert.ok(html.includes('data-action="approve"'));
assert.ok(html.includes('data-action="unapprove"'));
assert.ok(html.includes('data-action="review"'));
assert.ok(html.includes('title="Approve"') || html.includes("Onayla"));
assert.ok(html.includes("Onayı Kaldır") || html.includes("Unapprove"));
assert.ok(html.includes("btn-icon"));
assert.ok(html.includes('class="approval"'));
assert.ok(html.includes("Onay 1/2"));
assert.ok(PR_LIST_CSS.includes(".approval"));

// Liste view'larda Copilot model / Ek talimatlar yok — Ayarlar view'da
assert.ok(!html.includes('id="copilot-model"'), "liste HTML'de model select olmamali");
assert.ok(!html.includes('id="extra-instructions"'), "liste HTML'de ek talimatlar olmamali");
assert.ok(!html.includes('class="model-bar"'), "liste HTML'de model-bar olmamali");

const empty = buildPrListHtml({
  nonce: "n",
  selectedKey: "",
  reviewedKeys: [],
  message: { text: "Bitbucket token yok", commandId: "ykbPrReviewerExtended.saveToken" },
  rows: [],
});
assert.ok(empty.includes("Bitbucket token yok"));
assert.ok(empty.includes("ykbPrReviewerExtended.saveToken"));
assert.ok(!empty.includes('id="copilot-model"'));

const withModelsIgnored = buildPrListHtml({
  nonce: "n",
  rows: [],
  copilotModel: "claude-sonnet-4",
  copilotModels: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
  extraInstructions: "ignore me",
});
assert.ok(!withModelsIgnored.includes('id="copilot-model"'));
assert.ok(!withModelsIgnored.includes("Claude Sonnet 4"));

assert.ok(html.includes("pr-status"));
assert.ok(
  html.includes('type === "prStatus"') ||
    html.includes('type==="prStatus"') ||
    html.includes('msg.type === "prStatus"')
);
assert.ok(html.includes("scrollTop") && html.includes("getState"));

const settings = buildSettingsHtml({
  nonce: "n",
  copilotModel: "claude-sonnet-4",
  copilotModels: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  ],
  extraInstructions: "NPE kontrol et\n<script>x</script>",
});
assert.ok(settings.includes('id="copilot-model"'));
assert.ok(settings.includes("<select"));
assert.ok(settings.includes('value="gpt-4o"'));
assert.ok(settings.includes('value="claude-sonnet-4" selected'));
assert.ok(settings.includes("Claude Sonnet 4"));
assert.ok(settings.includes('type: "setModel"') || settings.includes('type:"setModel"'));
assert.ok(settings.includes('id="extra-instructions"'));
assert.ok(settings.includes("<textarea"));
assert.ok(settings.includes("Ek talimatlar"));
assert.ok(settings.includes("NPE kontrol et"));
assert.ok(settings.includes("&lt;script&gt;x&lt;/script&gt;"));
assert.ok(settings.includes('type: "setExtraInstructions"'));
assert.ok(settings.includes('class="model-bar"') || settings.includes('class="settings-bar"'));
assert.ok(PR_LIST_CSS.includes(".model-bar") || PR_LIST_CSS.includes(".settings-bar"));

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const views = pkg.contributes.views.ykbPrReviewerExtended;
assert.strictEqual(views[0].id, "ykbPrReviewerExtended.settings");
assert.strictEqual(views[0].name, "Ayarlar");
assert.strictEqual(views[0].type, "webview");
assert.ok(
  views.some((v) => v.id === "ykbPrReviewerExtended.myPrs"),
  "PR listeleri kalmali"
);

console.log("prListViewHtml tests OK");
