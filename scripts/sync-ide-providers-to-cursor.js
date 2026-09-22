"use strict";

const fs = require("fs");
const path = require("path");

function loadJsonc(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  raw = raw.replace(/^\s*\/\/.*$/gm, "");
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
  }
}

const codePath = path.join(
  process.env.APPDATA || "",
  "Code",
  "User",
  "settings.json"
);
const cursorPath = path.join(
  process.env.APPDATA || "",
  "Cursor",
  "User",
  "settings.json"
);
const code = loadJsonc(codePath);
const providers = code["ai-ide-assistant.providers"];
if (!Array.isArray(providers) || !providers.length) {
  console.error("Code settings'te ai-ide-assistant.providers yok");
  process.exit(1);
}
const cursor = loadJsonc(cursorPath);
const before = Array.isArray(cursor["ai-ide-assistant.providers"])
  ? cursor["ai-ide-assistant.providers"].length
  : 0;
cursor["ai-ide-assistant.providers"] = providers;
if (code["ai-ide-assistant.maxIterations"] != null) {
  cursor["ai-ide-assistant.maxIterations"] =
    code["ai-ide-assistant.maxIterations"];
}
fs.writeFileSync(cursorPath, JSON.stringify(cursor, null, 4) + "\n", "utf8");
console.log(
  "synced providers Code→Cursor; before=",
  before,
  "after=",
  providers.length
);
console.log(
  "enabled",
  providers.filter((p) => p && p.enabled).map((p) => p.id)
);
