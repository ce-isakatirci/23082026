const assert = require("assert");
const {
  buildRunReviewFlags,
  INLINE_PATH_LINE_HINT,
} = require("../out/reviewFlags");

const auto = buildRunReviewFlags("auto");
assert.strictEqual(auto.writeFile, false, "otomatik review local md yazmamali");
assert.strictEqual(auto.extraPromptHint, INLINE_PATH_LINE_HINT);
assert.strictEqual(auto.localBroadReview, true, "inline yollar local broad review");
assert.ok(
  INLINE_PATH_LINE_HINT.includes("Suggested code"),
  "inline hint kisa duzeltilmis kod istemeli"
);

const local = buildRunReviewFlags("local");
assert.strictEqual(local.writeFile, true, "Review Et local md yazmali");
assert.ok(!local.extraPromptHint);
assert.strictEqual(local.localBroadReview, true, "Review Et de local broad");

const inline = buildRunReviewFlags("inlineComment");
assert.strictEqual(inline.writeFile, true, "PR'a Comment At local md yazmaya devam eder");
assert.strictEqual(inline.extraPromptHint, INLINE_PATH_LINE_HINT);
assert.strictEqual(inline.localBroadReview, true);

console.log("reviewFlags tests OK");
