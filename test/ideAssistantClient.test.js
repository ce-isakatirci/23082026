const assert = require("assert");
const {
  buildChatCompletionsBody,
  contentFromChatResponse,
  stripThinkTags,
  maxTokensForInput,
  maxInputCharsForContext,
  CONTEXT_TOKENS,
} = require("../out/ideAssistantClient");

assert.strictEqual(CONTEXT_TOKENS, 262144, "Qwen3.6 native context");

const provider = { model: "cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit" };
const body = buildChatCompletionsBody(
  provider,
  "system",
  "user diff",
  { temperature: 0.2 }
);
assert.strictEqual(body.model, provider.model);
assert.strictEqual(body.temperature, 0.2);
assert.strictEqual(body.stream, false);
assert.strictEqual(body.enable_thinking, false);
assert.deepStrictEqual(body.chat_template_kwargs, { enable_thinking: false });
assert.ok(Number.isInteger(body.max_tokens));
assert.ok(body.max_tokens >= 1024);
assert.ok(body.max_tokens <= 8192);

assert.strictEqual(stripThinkTags("<think>gizli</think>\n## Critical"), "## Critical");
assert.ok(maxTokensForInput("a".repeat(1000), "b".repeat(1000)) >= 1024);
assert.ok(maxInputCharsForContext() > 100000, "262k → büyük input char tavanı");

const extracted = contentFromChatResponse({
  choices: [{ message: { content: "<think>x</think>\n## Minor" } }],
});
assert.strictEqual(extracted, "## Minor");

console.log("ideAssistantClient tests OK");
