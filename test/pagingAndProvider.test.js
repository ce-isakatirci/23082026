const assert = require("assert");
const {
  hasMorePages,
  nextPageStart,
  filterReposByQuery,
} = require("../out/prListModel");
const {
  pickReviewProvider,
  selectConfiguredProvider,
  buildChatCompletionsUrl,
} = require("../out/ideAssistantProvider");

assert.strictEqual(
  hasMorePages({ isLastPage: false, nextPageStart: 25, values: [] }),
  true
);
assert.strictEqual(
  hasMorePages({ isLastPage: true, nextPageStart: 25, values: [] }),
  false
);
assert.strictEqual(hasMorePages({ isLastPage: false, values: [] }), false);
assert.strictEqual(nextPageStart({ nextPageStart: 100 }), 100);

const repos = [
  {
    slug: "payment-service",
    name: "Payment Service",
    project: { key: "PAY", name: "Payments" },
  },
  {
    slug: "cosmos-swift-money-transfer",
    name: "Cosmos SWIFT Money Transfer",
    project: { key: "CSMT", name: "Cosmos" },
  },
];

assert.strictEqual(filterReposByQuery(repos, "").length, 2);
assert.strictEqual(
  filterReposByQuery(repos, "cosmos-swift-money-transfer").length,
  1
);
assert.strictEqual(filterReposByQuery(repos, "CSMT").length, 1);
assert.strictEqual(filterReposByQuery(repos, "no-such-repo").length, 0);

const providers = [
  {
    id: "qwen3-6",
    name: "qwen3",
    baseUrl: "https://example.invalid",
    model: "cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit",
    apiKey: "sk-test",
    type: "openai",
    enabled: true,
  },
  {
    id: "qwen-resim",
    name: "qwen3-resim",
    baseUrl: "https://example.invalid",
    model: "Qwen/Qwen3.5-27B",
    apiKey: "sk-test",
    type: "openai",
    enabled: false,
  },
];

const picked = pickReviewProvider(providers);
assert.ok(picked);
assert.strictEqual(picked.id, "qwen3-6");
assert.strictEqual(pickReviewProvider([]), null);
assert.strictEqual(pickReviewProvider([{ enabled: false, id: "qwen3" }]), null);
assert.strictEqual(
  pickReviewProvider([
    {
      id: "qwen3-6",
      name: "qwen3",
      baseUrl: "https://example.invalid",
      model: "qwen",
      apiKey: "sk-test",
      type: "openai",
    },
  ]),
  null,
  "enabled alani yoksa provider kullanilmamali"
);
assert.strictEqual(
  pickReviewProvider([
    {
      id: "qwen3-6",
      name: "qwen3",
      baseUrl: "https://example.invalid",
      model: "qwen",
      apiKey: "sk-test",
      type: "openai",
      enabled: false,
    },
  ]),
  null
);

const qwenEnabled = {
  id: "qwen3-6",
  name: "qwen3",
  baseUrl: "https://example.invalid",
  model: "qwen",
  apiKey: "sk-test",
  type: "openai",
  enabled: true,
};
assert.strictEqual(selectConfiguredProvider(false, [qwenEnabled]), null);
assert.strictEqual(selectConfiguredProvider(undefined, [qwenEnabled]), null);
assert.strictEqual(selectConfiguredProvider(true, [qwenEnabled]).id, "qwen3-6");

assert.strictEqual(
  buildChatCompletionsUrl("https://host.example"),
  "https://host.example/v1/chat/completions"
);
assert.strictEqual(
  buildChatCompletionsUrl("https://host.example/v1"),
  "https://host.example/v1/chat/completions"
);
assert.strictEqual(
  buildChatCompletionsUrl("https://host.example/v1/chat/completions"),
  "https://host.example/v1/chat/completions"
);

console.log("paging + provider tests OK");
