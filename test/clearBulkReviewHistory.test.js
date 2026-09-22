const assert = require("assert");
const {
  clearBulkReviewHistory,
} = require("../out/clearBulkReviewHistory");

async function run() {
  const deleted = [];
  let cleared = false;

  const result = await clearBulkReviewHistory({
    keys: [
      "PAY/payment-service/1",
      "PAY/payment-service/2",
      "bad-key",
      "PAY/only",
    ],
    deleteCommentsForTarget: async (target) => {
      deleted.push(`${target.projectKey}/${target.repoSlug}/${target.prId}`);
      return { attempted: 2, deleted: 1, markerCount: 2 };
    },
    clearStore: async () => {
      cleared = true;
    },
  });

  assert.strictEqual(cleared, true, "sayaç store temizlenmeli");
  assert.strictEqual(result.storeCleared, true);
  assert.deepStrictEqual(deleted, [
    "PAY/payment-service/1",
    "PAY/payment-service/2",
  ]);
  assert.strictEqual(result.targets, 2);
  assert.strictEqual(result.attemptedComments, 4);
  assert.strictEqual(result.deletedComments, 2);
  assert.strictEqual(result.markerComments, 4);
  assert.strictEqual(result.skippedKeys, 2);

  const empty = await clearBulkReviewHistory({
    keys: [],
    deleteCommentsForTarget: async () => {
      throw new Error("çağrılmamalı");
    },
    clearStore: async () => {},
  });
  assert.strictEqual(empty.targets, 0);
  assert.strictEqual(empty.deletedComments, 0);
  assert.strictEqual(empty.storeCleared, true);

  // Marker var, silinen 0 → store korunmalı (Silindi: 0 senaryosu)
  let clearedOnFail = false;
  const failDelete = await clearBulkReviewHistory({
    keys: ["PAY/payment-service/9"],
    deleteCommentsForTarget: async () => ({
      attempted: 0,
      deleted: 0,
      markerCount: 3,
    }),
    clearStore: async () => {
      clearedOnFail = true;
    },
  });
  assert.strictEqual(clearedOnFail, false, "silinemeyen marker varken store kalmalı");
  assert.strictEqual(failDelete.storeCleared, false);
  assert.strictEqual(failDelete.markerComments, 3);
  assert.strictEqual(failDelete.deletedComments, 0);
  assert.deepStrictEqual(failDelete.errors, []);

  // deleteCommentsForTarget errors → result.errors'ta toplanır
  const withErrors = await clearBulkReviewHistory({
    keys: ["PAY/payment-service/3"],
    deleteCommentsForTarget: async () => ({
      attempted: 1,
      deleted: 0,
      markerCount: 1,
      errors: [
        {
          phase: "delete",
          id: 9,
          error: { message: "409", status: 409 },
        },
      ],
    }),
    clearStore: async () => {},
  });
  assert.strictEqual(withErrors.errors.length, 1);
  assert.strictEqual(withErrors.errors[0].id, 9);

  console.log("clearBulkReviewHistory tests OK");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
