const assert = require("assert");
const { slugifyTitle, buildReviewFileName } = require("../out/reviewFileWriter");

assert.strictEqual(slugifyTitle("Payment Service refactor"), "payment-service-refactor");
assert.strictEqual(slugifyTitle("A   B!! C"), "a-b-c");

const fixed = new Date(2026, 8, 11, 9, 15, 30); // month 0-based
const name = buildReviewFileName("42", "Payment Service refactor", fixed);
assert.strictEqual(name, "review-#42-payment-service-refactor-2026-09-11T09-15-30.md");

console.log("filename tests OK");
