const assert = require("assert");
const {
  toModelChoice,
  mergeSelectedModel,
  fetchCopilotModels,
} = require("../out/copilotModels");

assert.deepStrictEqual(toModelChoice({ id: "gpt-4o", name: "GPT-4o", family: "gpt-4o" }), {
  id: "gpt-4o",
  label: "GPT-4o",
  family: "gpt-4o",
});
assert.strictEqual(toModelChoice({}), null);

const merged = mergeSelectedModel(
  [{ id: "gpt-4o", label: "GPT-4o", family: "gpt-4o" }],
  "claude-sonnet-4"
);
assert.strictEqual(merged[0].id, "claude-sonnet-4");
assert.ok(merged.some((m) => m.id === "gpt-4o"));

const already = mergeSelectedModel(
  [{ id: "claude-sonnet-4", label: "Claude Sonnet 4", family: "claude-sonnet-4" }],
  "claude-sonnet-4"
);
assert.strictEqual(already.length, 1);

async function runAsync() {
  const listed = await fetchCopilotModels(async () => [
    { id: "gpt-4o", name: "GPT-4o", family: "gpt-4o" },
  ]);
  assert.strictEqual(listed.length, 1);
  assert.strictEqual(listed[0].id, "gpt-4o");

  const empty = await fetchCopilotModels(async () => {
    throw new Error("no copilot");
  });
  assert.deepStrictEqual(empty, []);
}

runAsync()
  .then(() => {
    console.log("copilotModels tests OK");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
