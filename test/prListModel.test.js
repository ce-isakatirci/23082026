const assert = require("assert");
const {
  isRepoFiltered,
  inferCurrentUserSlug,
  reviewerStatus,
  prMatchesSearch,
  filterPrs,
  parseBitbucketRemote,
  formatPrDescription,
  parseGitConfigOriginUrl,
  toPrListRow,
} = require("../out/prListModel");

assert.strictEqual(isRepoFiltered("hmn-foo"), true);
assert.strictEqual(isRepoFiltered("HMNFE-bar"), true);
assert.strictEqual(isRepoFiltered("payments-sql"), true);
assert.strictEqual(isRepoFiltered("payment-service"), false);

const prs = [
  {
    id: 42,
    title: "Payment Service refactor",
    author: { user: { displayName: "Ada", slug: "ada" } },
    fromRef: { displayId: "feature/pay" },
    toRef: {
      displayId: "main",
      repository: { slug: "payment-service", project: { key: "PAY" } },
    },
    reviewers: [{ user: { slug: "me" }, status: "UNAPPROVED" }],
  },
  {
    id: 7,
    title: "SQL migration",
    author: { user: { displayName: "Bob", slug: "bob" } },
    fromRef: { displayId: "fix/sql" },
    toRef: {
      displayId: "develop",
      repository: { slug: "ledger-sql", project: { key: "PAY" } },
    },
    reviewers: [
      { user: { slug: "me" }, status: "APPROVED" },
      { user: { slug: "other" }, status: "UNAPPROVED" },
    ],
  },
];

assert.strictEqual(inferCurrentUserSlug(prs), "me");
assert.strictEqual(reviewerStatus(prs[0], "me"), "UNAPPROVED");
assert.strictEqual(reviewerStatus(prs[1], "me"), "APPROVED");

assert.strictEqual(prMatchesSearch(prs[0], ""), true);
assert.strictEqual(prMatchesSearch(prs[0], "payment"), true);
assert.strictEqual(prMatchesSearch(prs[0], "42"), true);
assert.strictEqual(prMatchesSearch(prs[0], "PAY/payment-service"), true);
assert.strictEqual(prMatchesSearch(prs[0], "xyz-no-hit"), false);

const visible = filterPrs(prs, { applyRepoFilter: true, query: "" });
assert.strictEqual(visible.length, 1);
assert.strictEqual(visible[0].id, 42);

const searched = filterPrs(prs, { applyRepoFilter: false, query: "sql" });
assert.strictEqual(searched.length, 1);
assert.strictEqual(searched[0].id, 7);

assert.deepStrictEqual(
  parseBitbucketRemote(
    "https://sdlc.yapikredi.com.tr/bitbucket/scm/PAY/payment-service.git"
  ),
  { projectKey: "PAY", repoSlug: "payment-service" }
);
assert.deepStrictEqual(
  parseBitbucketRemote("ssh://git@sdlc.yapikredi.com.tr:7999/PAY/payment-service.git"),
  { projectKey: "PAY", repoSlug: "payment-service" }
);
assert.strictEqual(parseBitbucketRemote(""), null);

assert.strictEqual(formatPrDescription(prs[0]), "feature/pay → main");

assert.deepStrictEqual(toPrListRow(prs[0], "me"), {
  projectKey: "PAY",
  repoSlug: "payment-service",
  prId: "42",
  title: "Payment Service refactor",
  description: "feature/pay → main",
  author: "Ada",
  status: "UNAPPROVED",
  approvedCount: 0,
  reviewerCount: 1,
});

assert.deepStrictEqual(toPrListRow(prs[1], "me"), {
  projectKey: "PAY",
  repoSlug: "ledger-sql",
  prId: "7",
  title: "SQL migration",
  description: "fix/sql → develop",
  author: "Bob",
  status: "APPROVED",
  approvedCount: 1,
  reviewerCount: 2,
});

const { approvalCounts } = require("../out/prListModel");
assert.deepStrictEqual(approvalCounts(prs[1]), {
  approvedCount: 1,
  reviewerCount: 2,
});
assert.deepStrictEqual(approvalCounts({ reviewers: [] }), {
  approvedCount: 0,
  reviewerCount: 0,
});
assert.deepStrictEqual(
  approvalCounts({
    reviewers: [{ user: { slug: "a" }, status: "UNAPPROVED" }],
    participants: [{ user: { slug: "a" }, status: "APPROVED" }],
  }),
  { approvedCount: 1, reviewerCount: 1 }
);

const fromGit = parseGitConfigOriginUrl(`
[core]
	bare = false
[remote "origin"]
	url = https://sdlc.yapikredi.com.tr/bitbucket/scm/PAY/payment-service.git
	fetch = +refs/heads/*:refs/remotes/origin/*
`);
assert.deepStrictEqual(fromGit, {
  projectKey: "PAY",
  repoSlug: "payment-service",
});

console.log("prListModel tests OK");
