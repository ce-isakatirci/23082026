"use strict";

const assert = require("assert");
const {
  isUnitTestPath,
  isUnitTestFileName,
} = require("../out/unitTestPath");

assert.strictEqual(isUnitTestPath("src/test/java/Foo.java"), true);
assert.strictEqual(isUnitTestPath("tests/Foo.java"), true);
assert.strictEqual(isUnitTestPath("__tests__/foo.js"), true);
assert.strictEqual(isUnitTestFileName("FooTest.java"), true);
assert.strictEqual(isUnitTestFileName("FooTests.java"), true);
assert.strictEqual(isUnitTestFileName("FooTest.kt"), true);
assert.strictEqual(isUnitTestFileName("app.test.ts"), true);
assert.strictEqual(isUnitTestFileName("app.spec.js"), true);
assert.strictEqual(isUnitTestFileName("app_test.ts"), true);
assert.strictEqual(isUnitTestFileName("Contest.java"), false);
assert.strictEqual(isUnitTestFileName("Foo.java"), false);
assert.strictEqual(isUnitTestPath("src/main/java/com/x/Contest.java"), false);
assert.strictEqual(isUnitTestPath("src/main/java/com/x/Foo.java"), false);

console.log("unitTestPath tests OK");
