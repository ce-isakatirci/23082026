const assert = require("assert");
const { readReviewBudget } = require("../out/reviewBudget");

assert.deepStrictEqual(readReviewBudget({}, {}), {
  maxDiffChars: 0,
  maxPromptChars: 0,
  maxFileChars: 0,
});

assert.deepStrictEqual(
  readReviewBudget(
    {
      maxDiffChars: 500,
      maxPromptChars: 900,
      maxFileChars: 100,
    },
    { maxDiffChars: 18000, maxPromptChars: 24000, maxFileChars: 12000 }
  ),
  {
    maxDiffChars: 500,
    maxPromptChars: 900,
    maxFileChars: 100,
  },
  "config degerleri floor/ceiling ile ezilmemeli"
);

assert.deepStrictEqual(
  readReviewBudget(
    {
      maxDiffChars: 0,
      maxPromptChars: 0,
      maxFileChars: 0,
    },
    { maxDiffChars: 18000, maxPromptChars: 24000, maxFileChars: 12000 }
  ),
  {
    maxDiffChars: 0,
    maxPromptChars: 0,
    maxFileChars: 0,
  },
  "0 sinirsiz anlaminda config'te kalmali"
);

assert.deepStrictEqual(
  readReviewBudget(
    {
      maxDiffChars: 999999,
      maxPromptChars: 50,
      maxFileChars: 12,
    },
    { maxDiffChars: 18000, maxPromptChars: 24000, maxFileChars: 12000 }
  ),
  {
    maxDiffChars: 999999,
    maxPromptChars: 50,
    maxFileChars: 12,
  }
);

assert.deepStrictEqual(
  readReviewBudget(
    {},
    { maxDiffChars: 18000, maxPromptChars: 24000, maxFileChars: 12000 }
  ),
  {
    maxDiffChars: 18000,
    maxPromptChars: 24000,
    maxFileChars: 12000,
  },
  "defaults yalnızca contribution/config katmanından gelmeli"
);

const { fitFileBudget } = require("../out/reviewBudget");
assert.strictEqual(fitFileBudget(0, 9000), 0, "0 = sinirsiz, overhead dusulmez");
assert.strictEqual(fitFileBudget(12000, 4000), 8000);
assert.strictEqual(fitFileBudget(1000, 5000), 1, "negatif kalanda dosya atlanmaz");

console.log("reviewBudget tests OK");
