const assert = require("assert");
const {
  reviewedPrKey,
  isPrReviewed,
  normalizeReviewCounts,
  listReviewedKeys,
  getReviewCount,
  incrementReviewedPr,
  addReviewedPr,
  clearReviewCounts,
  parseReviewedPrKey,
} = require("../out/reviewedPrMemory");

assert.strictEqual(
  reviewedPrKey("PAY", "payment-service", "42"),
  "PAY/payment-service/42"
);
assert.strictEqual(
  reviewedPrKey("PAY", "payment-service", 42),
  "PAY/payment-service/42"
);

assert.strictEqual(isPrReviewed([], "PAY", "payment-service", "42"), false);
assert.strictEqual(
  isPrReviewed(["PAY/payment-service/42"], "PAY", "payment-service", "42"),
  true
);
assert.strictEqual(
  isPrReviewed(["PAY/payment-service/42"], "PAY", "other-repo", "42"),
  false
);

const legacy = normalizeReviewCounts(["CSMT/cosmos/1", "PAY/payment-service/42"]);
assert.strictEqual(legacy["CSMT/cosmos/1"], 1);
assert.strictEqual(legacy["PAY/payment-service/42"], 1);
assert.deepStrictEqual(listReviewedKeys(legacy).sort(), [
  "CSMT/cosmos/1",
  "PAY/payment-service/42",
]);

let counts = incrementReviewedPr({}, "PAY", "payment-service", 42);
assert.strictEqual(counts["PAY/payment-service/42"], 1);
counts = incrementReviewedPr(counts, "PAY", "payment-service", "42");
assert.strictEqual(counts["PAY/payment-service/42"], 2);
assert.strictEqual(getReviewCount(counts, "PAY", "payment-service", "42"), 2);
assert.strictEqual(isPrReviewed(counts, "PAY", "payment-service", "42"), true);

const added = addReviewedPr({ "CSMT/cosmos/1": 1 }, "PAY", "payment-service", 42);
assert.strictEqual(added["PAY/payment-service/42"], 1);
assert.strictEqual(added["CSMT/cosmos/1"], 1);
const again = addReviewedPr(added, "PAY", "payment-service", "42");
assert.strictEqual(again["PAY/payment-service/42"], 2);

assert.deepStrictEqual(clearReviewCounts(), {});
assert.deepStrictEqual(clearReviewCounts({ "PAY/payment-service/42": 3 }), {});

assert.deepStrictEqual(parseReviewedPrKey("PAY/payment-service/42"), {
  projectKey: "PAY",
  repoSlug: "payment-service",
  prId: "42",
});
assert.strictEqual(parseReviewedPrKey(""), null);
assert.strictEqual(parseReviewedPrKey("PAY"), null);
assert.strictEqual(parseReviewedPrKey("PAY/only-repo"), null);
assert.strictEqual(parseReviewedPrKey("PAY/payment-service/42/extra"), null);

console.log("reviewedPrMemory tests OK");
