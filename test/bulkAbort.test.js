"use strict";

const assert = require("assert");
const {
  createBulkAbortGate,
  createBulkAbortError,
  isBulkAbortError,
} = require("../out/bulkAbort");

const gate = createBulkAbortGate();
assert.strictEqual(gate.isAborted(), false);

let notified = 0;
const off = gate.onAbort(() => {
  notified += 1;
});
gate.abort();
assert.strictEqual(gate.isAborted(), true);
assert.strictEqual(notified, 1);

// ikinci abort no-op; listener tekrar çağrılmaz
gate.abort();
assert.strictEqual(notified, 1);

off();
const gate2 = createBulkAbortGate();
assert.throws(() => {
  gate2.abort();
  gate2.throwIfAborted();
}, (err) => isBulkAbortError(err));

const err = createBulkAbortError("test stop");
assert.ok(isBulkAbortError(err));
assert.ok(String(err.message).includes("test stop"));
assert.strictEqual(isBulkAbortError(new Error("other")), false);
assert.strictEqual(isBulkAbortError(null), false);

console.log("bulkAbort tests OK");
