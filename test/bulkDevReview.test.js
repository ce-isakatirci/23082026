const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { isPrTargetingDev, filterPrsTargetingDev } = require("../out/prListModel");
const {
  buildBulkDevReviewHtml,
  PR_LIST_CSS,
} = require("../out/prListViewHtml");
const {
  repoSelectionKey,
  normalizeSelectedRepos,
  setRepoSelected,
  isRepoSelected,
  areAllVisibleReposSelected,
  setVisibleReposSelected,
  toggleAllVisibleReposSelected,
  prepareBulkPrRows,
  setPrRowChecked,
  setAllPrRowsChecked,
  toggleAllPrRowsChecked,
  selectBulkPendingRows,
} = require("../out/bulkDevReviewSelection");
const { reviewedPrKey } = require("../out/reviewedPrMemory");

assert.strictEqual(isPrTargetingDev({ toRef: { displayId: "dev" } }), true);
assert.strictEqual(isPrTargetingDev({ toRef: { displayId: "origin/dev" } }), true);
assert.strictEqual(isPrTargetingDev({ toRef: { displayId: "main" } }), false);
assert.strictEqual(isPrTargetingDev({ toRef: { displayId: "develop" } }), false);
assert.strictEqual(isPrTargetingDev(null), false);

const prs = [
  { id: 1, toRef: { displayId: "dev" } },
  { id: 2, toRef: { displayId: "main" } },
  { id: 3, toRef: { displayId: "origin/dev" } },
];
const onlyDev = filterPrsTargetingDev(prs);
assert.deepStrictEqual(
  onlyDev.map((p) => p.id),
  [1, 3]
);

assert.strictEqual(repoSelectionKey("PAY", "payment-service"), "PAY/payment-service");

let selected = [];
selected = setRepoSelected(selected, "PAY", "payment-service", true);
assert.strictEqual(isRepoSelected(selected, "PAY", "payment-service"), true);
selected = setRepoSelected(selected, "PAY", "payment-service", false);
assert.strictEqual(isRepoSelected(selected, "PAY", "payment-service"), false);

selected = setRepoSelected([], "PAY", "a", true);
selected = setRepoSelected(selected, "PAY", "a", true);
assert.strictEqual(normalizeSelectedRepos(selected).length, 1);

const visibleRepos = [
  { projectKey: "PAY", repoSlug: "payment-service" },
  { projectKey: "PAY", repoSlug: "ledger" },
];
let repoPick = [{ projectKey: "OTHER", repoSlug: "keep-me" }];
repoPick = setVisibleReposSelected(visibleRepos, repoPick, true);
assert.strictEqual(isRepoSelected(repoPick, "PAY", "payment-service"), true);
assert.strictEqual(isRepoSelected(repoPick, "PAY", "ledger"), true);
assert.strictEqual(
  isRepoSelected(repoPick, "OTHER", "keep-me"),
  true,
  "listede olmayan seçim korunur"
);
assert.strictEqual(areAllVisibleReposSelected(visibleRepos, repoPick), true);
const repoToggleOff = toggleAllVisibleReposSelected(visibleRepos, repoPick);
assert.strictEqual(repoToggleOff.checked, false);
assert.strictEqual(
  isRepoSelected(repoToggleOff.selectedRepos, "PAY", "payment-service"),
  false
);
assert.strictEqual(
  isRepoSelected(repoToggleOff.selectedRepos, "OTHER", "keep-me"),
  true,
  "toggle off yalnızca görünür listeden kaldırır"
);
const repoToggleOn = toggleAllVisibleReposSelected(
  visibleRepos,
  repoToggleOff.selectedRepos
);
assert.strictEqual(repoToggleOn.checked, true);
assert.strictEqual(
  areAllVisibleReposSelected(visibleRepos, repoToggleOn.selectedRepos),
  true
);

const reviewedKey = reviewedPrKey("PAY", "payment-service", "1");
const prepared = prepareBulkPrRows(
  [
    {
      projectKey: "PAY",
      repoSlug: "payment-service",
      prId: "1",
      title: "Old",
    },
    {
      projectKey: "PAY",
      repoSlug: "payment-service",
      prId: "2",
      title: "New",
    },
  ],
  [reviewedKey]
);
assert.strictEqual(prepared[0].prId, "2", "review edilmemis ilk sirada");
assert.strictEqual(prepared[0].checked, true);
assert.strictEqual(prepared[1].prId, "1");
assert.strictEqual(prepared[1].checked, false);

const toggled = setPrRowChecked(prepared, "PAY", "payment-service", "1", true);
assert.strictEqual(toggled.find((r) => r.prId === "1").checked, true);

const allChecked = setAllPrRowsChecked(prepared, true);
assert.strictEqual(allChecked.every((r) => r.checked), true);

const toggledOff = toggleAllPrRowsChecked(allChecked);
assert.strictEqual(toggledOff.checked, false);
assert.strictEqual(toggledOff.rows.every((r) => !r.checked), true);
const toggledOn = toggleAllPrRowsChecked(toggledOff.rows);
assert.strictEqual(toggledOn.checked, true);
assert.strictEqual(toggledOn.rows.every((r) => r.checked), true);

const alreadyCommentedRows = [
  { projectKey: "PAY", repoSlug: "payment-service", prId: "1", checked: true },
  { projectKey: "PAY", repoSlug: "payment-service", prId: "2", checked: true },
];
const bulkPending = selectBulkPendingRows(alreadyCommentedRows);
assert.strictEqual(
  bulkPending.length,
  2,
  "önceki bot comment olsa da checked PR bulk pending'den düşmez"
);
assert.deepStrictEqual(bulkPending, alreadyCommentedRows);
assert.deepStrictEqual(selectBulkPendingRows(null), []);
assert.deepStrictEqual(selectBulkPendingRows(undefined), []);

const html = buildBulkDevReviewHtml({
  nonce: "n",
  query: "payment",
  repos: [
    { projectKey: "PAY", repoSlug: "payment-service", name: "Payment Service" },
    { projectKey: "PAY", repoSlug: "ledger", name: "Ledger" },
  ],
  selectedRepos: [{ projectKey: "PAY", repoSlug: "payment-service" }],
  statusText: "",
});

assert.ok(html.includes('id="bulk-repo-search"'));
assert.ok(html.includes('id="bulk-run"'));
assert.ok(html.includes('id="bulk-stop"'), "kirmizi Durdur butonu");
assert.ok(
  html.includes('type: "stopBulk"') || html.includes('type:"stopBulk"'),
  "Durdur stopBulk mesaji gondermeli"
);
assert.ok(
  /id="bulk-stop"[^>]*disabled|id="bulk-stop" disabled/.test(html) ||
    html.includes('id="bulk-stop" disabled'),
  "Durdur idle iken disabled"
);
assert.ok(
  PR_LIST_CSS.includes("bulk-stop") || html.includes("bulk-stop"),
  "Durdur kirmizi stil"
);
assert.ok(html.includes('id="bulk-clear-history"'), "gecmis silme butonu");
assert.ok(
  html.includes('type: "clearHistory"') || html.includes('type:"clearHistory"'),
  "clearHistory mesaji gondermeli"
);
assert.ok(
  PR_LIST_CSS.includes("bulk-clear-history") || html.includes("bulk-clear-history"),
  "gecmis silme kirmizi stil"
);
assert.ok(html.includes('id="bulk-load-prs"'));
assert.ok(html.includes('id="bulk-select-all"'));
assert.ok(html.includes("Tümünü seç"));
assert.ok(html.includes('type: "selectAllPrs"') || html.includes('type:"selectAllPrs"'));
assert.ok(html.includes('id="bulk-select-all-repos"'), "repo panel Tümünü seç");
assert.ok(
  html.includes('type: "selectAllRepos"') || html.includes('type:"selectAllRepos"'),
  "selectAllRepos mesaji"
);
assert.ok(
  PR_LIST_CSS.includes("bulk-repo-toolbar") || html.includes("bulk-repo-toolbar"),
  "repo toolbar stil"
);
assert.ok(html.includes("Dev Bulk Review") || html.includes("dev PR"));
assert.ok(html.includes('type="checkbox"'));
assert.ok(html.includes('data-project="PAY"'));
assert.ok(html.includes('data-repo="payment-service"'));
assert.ok(html.includes("checked") || html.includes('checked="checked"'));
assert.ok(html.includes('type: "searchRepos"') || html.includes('type:"searchRepos"'));
assert.ok(html.includes('type: "toggleRepo"') || html.includes('type:"toggleRepo"'));
assert.ok(html.includes('type: "loadPrs"') || html.includes('type:"loadPrs"'));
assert.ok(html.includes('type: "runBulk"') || html.includes('type:"runBulk"'));
assert.ok(PR_LIST_CSS.includes(".bulk-repo-row") || html.includes("bulk-repo"));
assert.ok(
  html.includes("selectedCount") && html.includes("bulk-run"),
  "client selectedCount ile buton metnini guncellemeli"
);
assert.ok(html.includes('id="bulk-repos-panel"'), "repos collapse panel");
assert.ok(html.includes('id="bulk-prs-panel"'), "PR collapse panel");
assert.ok(html.includes("<details"), "native details collapse");
assert.ok(
  !/<details[^>]*\sopen[\s>]/.test(html),
  "collapse paneller default kapali (open yok)"
);
assert.ok(
  html.includes("reposOpen") && html.includes("prsOpen"),
  "client collapse open state persist etmeli"
);
assert.ok(
  PR_LIST_CSS.includes(".bulk-root .pr-review-badge") &&
    PR_LIST_CSS.includes("bottom:"),
  "bulk review badge sag alt"
);

const withPrs = buildBulkDevReviewHtml({
  nonce: "n2",
  repos: [],
  selectedRepos: [{ projectKey: "PAY", repoSlug: "payment-service" }],
  prRows: [
    {
      projectKey: "PAY",
      repoSlug: "payment-service",
      prId: "99",
      title: "Fix fee",
      description: "feature → dev",
      author: "Ada",
      status: "UNAPPROVED",
      checked: true,
    },
    {
      projectKey: "PAY",
      repoSlug: "payment-service",
      prId: "1",
      title: "Old reviewed",
      description: "feature → dev",
      author: "Bob",
      status: "UNAPPROVED",
      checked: false,
    },
  ],
  reviewedKeys: [reviewedPrKey("PAY", "payment-service", "1")],
  reviewCounts: { [reviewedPrKey("PAY", "payment-service", "1")]: 2 },
});
assert.ok(withPrs.includes('id="bulk-pr-list"'));
assert.ok(withPrs.includes('class="pr-review-badge"'));
assert.ok(withPrs.includes(">2<"));
assert.ok(withPrs.includes('data-pr-id="99"'));
assert.ok(withPrs.includes("Fix fee"));
assert.ok(withPrs.includes('type: "togglePr"') || withPrs.includes('type:"togglePr"'));
assert.ok(withPrs.includes('data-action="review"'), "ortak kart Review butonu");
assert.ok(withPrs.includes('data-action="comment"'), "ortak kart Comment butonu");
assert.ok(withPrs.includes('data-action="preview"'), "ortak kart Preview butonu");
assert.ok(withPrs.includes('data-action="approve"'), "ortak kart Onayla butonu");
assert.ok(withPrs.includes('data-action="unapprove"'), "ortak kart Unapprove butonu");
assert.ok(
  withPrs.includes('type: "action"') || withPrs.includes('type:"action"'),
  "bulk client action mesaji gondermeli"
);
assert.ok(withPrs.includes('class="approval"'), "Onay sayaci");
assert.ok(withPrs.indexOf("Fix fee") < withPrs.indexOf("Old reviewed"));
assert.ok(withPrs.includes("pr-row reviewed"));
assert.ok(withPrs.includes("pr-status-bar") || withPrs.includes("pr-status-fill"));
assert.ok(
  withPrs.includes('type === "prStatus"') ||
    withPrs.includes('msg.type === "prStatus"') ||
    withPrs.includes('type==="prStatus"'),
  "bulk panel prStatus progress dinlemeli"
);

const idx99 = withPrs.indexOf('data-pr-id="99"');
const idx1 = withPrs.indexOf('data-pr-id="1"');
assert.ok(idx99 >= 0 && idx1 >= 0);
assert.ok(
  /data-pr-check="1"[^>]*data-pr-id="99"[^>]*checked|data-pr-id="99"[^>]*checked/.test(
    withPrs
  ),
  "yeni PR checkbox checked"
);

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const views = pkg.contributes.views.ykbPrReviewerExtended;
assert.strictEqual(pkg.version, "1.7.16");
assert.ok(
  views.some(
    (v) =>
      v.id === "ykbPrReviewerExtended.bulkDevReview" &&
      v.name === "Dev Bulk Review" &&
      v.type === "webview"
  ),
  "Dev Bulk Review webview view olmali"
);
assert.ok(
  pkg.activationEvents.includes("onView:ykbPrReviewerExtended.bulkDevReview"),
  "activationEvents bulkDevReview icermeli"
);
assert.ok(
  views.some(
    (v) =>
      v.id === "ykbPrReviewerExtended.codeReview" &&
      v.name === "Code Review" &&
      v.type === "webview"
  ),
  "Code Review webview view olmali"
);
assert.ok(
  pkg.activationEvents.includes("onView:ykbPrReviewerExtended.codeReview"),
  "activationEvents codeReview icermeli"
);
assert.ok(
  pkg.contributes.commands.some(
    (cmd) => cmd.command === "ykbPrReviewerExtended.runCodeReview"
  ),
  "runCodeReview command olmali"
);

console.log("bulkDevReview tests OK");
