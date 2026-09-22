"use strict";

/**
 * Artık uzun metin defaults.json'da değil; .md dosyalarındadır.
 * Bu script skills path'lerinin defaults.json'da durduğunu doğrular.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultsPath = path.join(root, "prompt", "defaults.json");
const defaults = JSON.parse(fs.readFileSync(defaultsPath, "utf8"));
const files = defaults.files || {};

for (const [key, rel] of Object.entries(files)) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    throw new Error("Eksik prompt dosyasi: " + key + " -> " + abs);
  }
}
console.log("prompt md files OK:", Object.keys(files).length);
