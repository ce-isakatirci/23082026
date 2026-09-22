"use strict";

const assert = require("assert");
const { redact, serializeError } = require("../out/reviewLog");

assert.strictEqual(redact({ apiKey: "sk-secret", model: "qwen" }).apiKey, "***");
assert.strictEqual(redact({ token: "abc", name: "x" }).token, "***");
assert.strictEqual(redact({ Authorization: "Bearer x" }).Authorization, "***");
assert.strictEqual(redact({ model: "qwen" }).model, "qwen");

const long = "a".repeat(5000);
const short = redact(long);
assert.ok(typeof short === "string");
assert.ok(short.includes("(+"));
assert.ok(short.length < 5000);

const longOk = redact(long, 0, { maxStringChars: 100000 });
assert.strictEqual(longOk.length, 5000, "payload limiti uzun prompt kesmesin");

const plain = serializeError(new Error("boom"));
assert.strictEqual(plain.message, "boom");
assert.ok(plain.stack && plain.stack.includes("boom"));

const axiosLike = new Error("Request failed with status code 403");
axiosLike.response = {
  status: 403,
  statusText: "Forbidden",
  data: { errors: [{ message: "no access" }] },
};
const full = serializeError(axiosLike);
assert.strictEqual(full.status, 403);
assert.strictEqual(full.statusText, "Forbidden");
assert.deepStrictEqual(full.responseData, {
  errors: [{ message: "no access" }],
});

assert.deepStrictEqual(serializeError(null), { message: "unknown" });
assert.deepStrictEqual(serializeError("x"), { message: "x" });

console.log("reviewLog tests OK");
