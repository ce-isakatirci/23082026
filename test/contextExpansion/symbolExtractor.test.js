"use strict";

const assert = require("assert");
const { extractSymbolsFromDiff } = require("../../out/contextExpansion/symbolExtractor");

function hunkDiff(filePath, addedLine) {
  return {
    destination: { toString: filePath },
    hunks: [
      {
        sourceLine: 1,
        sourceSpan: 1,
        destinationLine: 1,
        destinationSpan: 1,
        segments: [
          {
            type: "ADDED",
            lines: [{ line: addedLine }],
          },
        ],
      },
    ],
  };
}

const diffData = {
  diffs: [
    hunkDiff("src/i18n/tr.ts", "  holdModal: {"),
    hunkDiff("src/i18n/tr.ts", "    title: 'Bekletme Nedenini Seçin',"),
  ],
};

const symbols = extractSymbolsFromDiff(diffData, ["src/i18n/tr.ts"]);
assert.ok(symbols.includes("holdModal"));
assert.ok(symbols.includes("holdModal.title") || symbols.includes("title"));

const tDiff = {
  diffs: [hunkDiff("src/Foo.tsx", "  return t('message.insufficientBalanceWarning');")],
};
const tSymbols = extractSymbolsFromDiff(tDiff, ["src/Foo.tsx"]);
assert.ok(tSymbols.includes("message.insufficientBalanceWarning"));
assert.ok(tSymbols.includes("message"));

console.log("symbolExtractor tests OK");
