"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  resolvePrAgentCommand,
  resolvePraLlmFromIdeProviders,
  runPrAgentHealthCheck,
} = require("../out/prAgentCliRunner");

function loadJsonc(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  // BOM
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  // strip // line comments
  raw = raw.replace(/^\s*\/\/.*$/gm, "");
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
  }
}

function escapeToml(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function main() {
  const candidates = [
    path.join(process.env.APPDATA || "", "Code", "User", "settings.json"),
    path.join(process.env.APPDATA || "", "Cursor", "User", "settings.json"),
  ];
  let settingsPath = "";
  let settings = null;
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = loadJsonc(p);
      if (
        Array.isArray(parsed["ai-ide-assistant.providers"]) &&
        parsed["ai-ide-assistant.providers"].length
      ) {
        settingsPath = p;
        settings = parsed;
        break;
      }
      if (!settings) {
        settingsPath = p;
        settings = parsed;
      }
    } catch (err) {
      console.error("settings parse fail", p, err.message);
    }
  }
  if (!settings) {
    console.error("settings.json bulunamadı");
    process.exit(1);
  }
  console.log("settings", settingsPath);
  const providers = settings["ai-ide-assistant.providers"] || [];
  const llm = resolvePraLlmFromIdeProviders(providers);
  if (!llm) {
    console.error(
      "ai-ide-assistant.providers içinde enabled:true kayıt bulunamadı"
    );
    process.exit(1);
  }

  const praDir = path.join(os.homedir(), ".pr_agent");
  fs.mkdirSync(praDir, { recursive: true });
  const cfgPath = path.join(praDir, "configuration.toml");
  const secretsPath = path.join(praDir, ".secrets.toml");
  const bodyCfg = [
    "[config]",
    `model = "${escapeToml(llm.model)}"`,
    "fallback_models = []",
    "custom_model_max_tokens = 32000",
    "custom_reasoning_model = true",
    "",
  ].join("\n");
  const bodySec = [
    "[openai]",
    `key = "${escapeToml(llm.apiKey)}"`,
    `api_base = "${escapeToml(llm.apiBase)}"`,
    "",
  ].join("\n");
  fs.writeFileSync(cfgPath, bodyCfg, "utf8");
  fs.writeFileSync(secretsPath, bodySec, "utf8");

  const pkgSettings = path.join(
    os.homedir(),
    "python",
    "Lib",
    "site-packages",
    "pr_agent",
    "settings"
  );
  if (fs.existsSync(pkgSettings)) {
    fs.writeFileSync(path.join(pkgSettings, ".secrets.toml"), bodySec, "utf8");
  }

  console.log("cmd", resolvePrAgentCommand({}));
  console.log("model", llm.model);
  console.log("apiBase", llm.apiBase);
  console.log("wrote", cfgPath);
  console.log("wrote", secretsPath);

  const health = await runPrAgentHealthCheck({}, undefined, undefined, llm);
  console.log("health", health.ok, health.message);
  process.exit(health.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
