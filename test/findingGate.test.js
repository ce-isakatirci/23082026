"use strict";

const assert = require("assert");
const {
  gateReviewMarkdown,
  parseFindings,
} = require("../out/findingGate");

const CHANGED = [
  "src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java",
  "src/main/java/com/ykb/nl/sepa/dao/repository/specifications/MessageInquirySpecs.java",
  "src/main/java/com/ykb/nl/sepa/batch/instantpayments/business/pacs2/InstantIncomingCTPSParser.java",
  "src/main/java/com/ykb/nl/sepa/service/messageinquiry/XmlContentResolver.java",
  "src/main/java/com/ykb/nl/sepa/dto/messageinquiry/MessageContentDTO.java",
  "src/main/java/com/ykb/nl/sepa/dto/messageinquiry/MessageDownloadDTO.java",
  "src/main/java/com/ykb/nl/sepa/web/MessageInquiryController.java",
];

function sampleReview() {
  return `## Özet
Parça sayısı: 2.

## Critical
**File:** \`src/main/java/com/ykb/nl/sepa/dao/repository/specifications/MessageInquirySpecs.java:33\`
**Issue:** Criteria root.get("messageTypeDefinition").get("id") NullPointerException fırlatır.
**Why it matters:** İlişki null olunca NPE ile API 500 döner.

**File:** \`src/main/java/com/ykb/nl/sepa/service/messageinquiry/XmlContentResolver.java:137\`
**Issue:** DocumentBuilderFactory.newInstance() her çağrıda; factory thread-safe değildir, static paylaşılmalı.
**Why it matters:** Concurrent parse güvenli değil.

**File:** \`src/main/java/com/ykb/nl/sepa/batch/instantpayments/business/pacs2/InstantIncomingCTPSParser.java:120\`
**Issue:** findByIncomingMessageMasterId ile save arasında TOCTOU race condition.
**Why it matters:** İki thread aynı anda insert edebilir; unique constraint yok.

**File:** \`src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java:86\`
**Issue:** orphanRemoval = true ve clear() ile child silinir.
**Why it matters:** Beklenmedik data loss.

**File:** \`src/test/java/com/ykb/nl/sepa/service/messageinquiry/XmlContentResolverTest.java:27\`
**Issue:** Test mock global false.
**Why it matters:** Nitpick.

## Important
**File:** \`src/main/java/com/ykb/nl/sepa/dto/messageinquiry/MessageContentDTO.java:23\`
**Issue:** content String Base64.
**Why it matters:** Heap.

## Sonuç
Needs work — Critical bulgu var.
`;
}

const gated = gateReviewMarkdown(sampleReview(), { changedPaths: CHANGED });

assert.ok(
  !/Criteria root\.get[\s\S]*NullPointerException/i.test(gated.markdown),
  "S6 Criteria NPE drop edilmeli"
);
assert.ok(
  !/thread-safe değildir, static/i.test(gated.markdown),
  "S10 factory inverted drop edilmeli"
);
assert.ok(
  !/XmlContentResolverTest/i.test(gated.markdown),
  "unit test noise drop edilmeli"
);

const criticalBody = gated.markdown.match(/## Critical\n([\s\S]*?)(?=\n## |$)/);
assert.ok(criticalBody, "Critical section kalmalı (orphanRemoval)");
assert.ok(
  /orphanRemoval/i.test(criticalBody[1]),
  "S5 orphanRemoval+clear Critical kalmalı"
);
assert.ok(
  !/TOCTOU|race condition/i.test(criticalBody[1]),
  "TOCTOU Critical'da kalmamalı"
);

const importantBody = gated.markdown.match(/## Important\n([\s\S]*?)(?=\n## |$)/);
assert.ok(importantBody, "Important section olmali");
assert.ok(
  /TOCTOU|race condition/i.test(importantBody[1]),
  "S1 TOCTOU Important'a dusmeli"
);

assert.ok(
  gated.dropped.some((d) => d.reason === "jpa_criteria_path_npe"),
  "drop reason jpa_criteria_path_npe"
);
assert.ok(
  gated.dropped.some((d) => d.reason === "factory_thread_safety_inverted"),
  "drop reason factory_thread_safety_inverted"
);
assert.ok(
  gated.downgraded.some((d) => d.reason === "race_without_constraint"),
  "downgrade race_without_constraint"
);

const outOfDiff = gateReviewMarkdown(
  `## Critical
**File:** \`src/main/java/com/ykb/nl/sepa/other/NotInDiff.java:1\`
**Issue:** something
**Why it matters:** x
`,
  { changedPaths: CHANGED }
);
assert.ok(
  outOfDiff.dropped.some((d) => d.reason === "out_of_diff"),
  "out_of_diff drop"
);
assert.ok(!/## Critical/.test(outOfDiff.markdown), "bos Critical basligi yok");

const disabled = gateReviewMarkdown(sampleReview(), {
  changedPaths: CHANGED,
  enabled: false,
});
assert.ok(
  /NullPointerException/i.test(disabled.markdown),
  "enabled false bypass"
);

const parsed = parseFindings(sampleReview());
assert.ok(parsed.length >= 5, "parseFindings en az 5 bulgu");

const FIELD_CHANGED = CHANGED.concat([
  "src/main/java/com/ykb/nl/sepa/dao/repository/OutgoingMessageMasterRepository.java",
  "src/main/java/com/ykb/nl/sepa/batch/sepaincoming/parse/service/CommonParserServiceImpl.java",
]);

const raceSuggested = gateReviewMarkdown(
  `## Critical
**File:** \`src/main/java/com/ykb/nl/sepa/batch/instantpayments/business/pacs2/InstantIncomingCTPSParser.java:120\`
**Issue:** Race condition: TOCTOU (Time-of-check to Time-of-use) gap in idempotent insert logic.
**Why it matters:** findByIncomingMessageMasterId kontrolü ile save arasında race window vardır. Aynı incomingMessageMasterId ile iki thread aynı anda isEmpty() kontrolünü true görüp save çağrısı yapabilir. Bu durum UniqueKeyViolationException (veya benzeri DB constraint hatası) ile sonuçlanır ve transaction rollback’e gider.
**Suggested code:**
\`\`\`java
// DB level unique constraint + OptimisticLock veya Pessimistic Lock kullanımı önerilir.
try {
    incomingMessageToPersist = incomingMessageRepositoryWR.save(incomingMessage);
} catch (DataIntegrityViolationException e) {
    List<IncomingMessageEntityWR> existing = incomingMessageRepositoryWR.findByIncomingMessageMasterId(incomingMessageMaster.getId());
    incomingMessageToPersist = existing.get(0);
}
\`\`\`

**File:** \`src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java:86\`
**Issue:** orphanRemoval = true ve clear() ile child silinir.
**Why it matters:** Beklenmedik data loss.
`,
  { changedPaths: FIELD_CHANGED }
);
assert.ok(
  raceSuggested.downgraded.some((d) => d.reason === "race_without_constraint"),
  "Suggested 'unique constraint önerilir' TOCTOU'yu Critical tutmamalı"
);
const raceCritical = raceSuggested.markdown.match(
  /## Critical\n([\s\S]*?)(?=\n## |$)/
);
assert.ok(raceCritical, "orphan Critical basligi");
assert.ok(
  !/TOCTOU/i.test(raceCritical[1]),
  "saha TOCTOU Critical'da kalmamalı"
);
assert.ok(
  /orphanRemoval/i.test(raceCritical[1]),
  "orphanRemoval+clear Critical kalmalı"
);

const xxeDecode = gateReviewMarkdown(
  `## Critical
**File:** \`src/main/java/com/ykb/nl/sepa/service/messageinquiry/XmlContentResolver.java:130\`
**Issue:** XML External Entity (XXE) ve BOM sızıntısı: decodeDocumentBase64IfNeeded yapılandırması yetersiz.
**Why it matters:** Kodda disallow-doctype-decl ve setExpandEntityReferences(false) ayarları mevcut, ancak FEATURE_SECURE_PROCESSING açıkça kapatılmamış.
`,
  { changedPaths: FIELD_CHANGED }
);
assert.ok(
  xxeDecode.downgraded.some((d) => d.reason === "incomplete_xxe"),
  "disallow-doctype geçen XXE Critical→Important"
);
assert.ok(!/## Critical/.test(xxeDecode.markdown), "XXE decode Critical basligi yok");
assert.ok(/## Important/.test(xxeDecode.markdown), "XXE decode Important");

const xxePretty = gateReviewMarkdown(
  `## Important
**File:** \`src/main/java/com/ykb/nl/sepa/service/messageinquiry/XmlContentResolver.java:155\`
**Issue:** XML Pretty-Print sırasında XXE riski: FEATURE_SECURE_PROCESSING eksik.
**Why it matters:** disallow-doctype-decl mevcut; Transformer ACCESS_EXTERNAL_* yok.
`,
  { changedPaths: FIELD_CHANGED }
);
assert.ok(
  !xxePretty.dropped.length && !xxePretty.downgraded.length,
  "prettyPrint XXE Important kalır"
);
assert.ok(/Pretty-Print/i.test(xxePretty.markdown));

const calendarDrop = gateReviewMarkdown(
  `## Important
**File:** \`src/main/java/com/ykb/nl/sepa/dao/repository/specifications/MessageInquirySpecs.java:104\`
**Issue:** Calendar API'si ile tarih/saat hesaplaması: startOfDay ve endOfDay.
**Why it matters:** Calendar class'ı mutable ve thread-safe değildir. Bu metodlar static olarak tanımlanmış; getInstance her çağrıda yeni Calendar üretir gibi görünse de Specification lambda içinde race condition'a yol açabilir.
`,
  { changedPaths: FIELD_CHANGED }
);
assert.ok(
  calendarDrop.dropped.some((d) => d.reason === "calendar_local_instance"),
  "lokal Calendar thread-safety drop"
);

const criteriaNplus = gateReviewMarkdown(
  `## Important
**File:** \`src/main/java/com/ykb/nl/sepa/dao/repository/specifications/MessageInquirySpecs.java:43\`
**Issue:** messageTypeDefinition ilişkisinde N+1 sorgu riski: root.get("messageTypeDefinition").get("id").
**Why it matters:** root.get Criteria Path join oluşturur; N+1 query ve distinct(true) performansı etkiler.
`,
  { changedPaths: FIELD_CHANGED }
);
assert.ok(
  criteriaNplus.dropped.some((d) => d.reason === "jpa_criteria_join_nplusone"),
  "Criteria Path.get N+1 drop (NPE değil)"
);

const wrHunk = gateReviewMarkdown(
  `## Minor
**File:** \`src/main/java/com/ykb/nl/sepa/dao/repository/OutgoingMessageMasterRepository.java:32\`
**Issue:** JPQL sorgusunda OutgoingMessageMasterEntityWR kullanılmış.
**Why it matters:** findDistinctMessageStatuses SELECT DISTINCT WR entity'ye atıfta bulunuyor; runtime kırılır.
`,
  { changedPaths: FIELD_CHANGED }
);
assert.ok(
  wrHunk.dropped.some((d) => d.reason === "wrong_hunk_wr_entity"),
  "WR entity yeni DISTINCT query drop"
);

const nitpickElse = gateReviewMarkdown(
  `## Minor
**File:** \`src/main/java/com/ykb/nl/sepa/batch/sepaincoming/parse/service/CommonParserServiceImpl.java:554\`
**Issue:** Gereksiz else bloğu ve kod tekrarı.
**Why it matters:** if-else yapısı kozmetik; Nitpick olarak sınıflandırılıyor çünkü işlevsel bozulma yok.
**Suggested code:**
\`\`\`java
incomingMessageMaster.getIncomingMessages().clear();
\`\`\`
`,
  { changedPaths: FIELD_CHANGED }
);
assert.ok(
  nitpickElse.dropped.some((d) => d.reason === "nitpick"),
  "gereksiz else nitpick drop"
);

const deduped = gateReviewMarkdown(
  `## Critical
**File:** \`src/main/java/com/ykb/nl/sepa/batch/instantpayments/business/pacs2/InstantIncomingCTPSParser.java:120\`
**Issue:** findByIncomingMessageMasterId ile save arasında TOCTOU race condition.
**Why it matters:** İki thread aynı anda insert edebilir; unique constraint yok.

## Important
**File:** \`src/main/java/com/ykb/nl/sepa/batch/instantpayments/business/pacs2/InstantIncomingCTPSParser.java:120\`
**Issue:** N+1 query pattern: findByIncomingMessageMasterId her parse için DB hiti.
**Why it matters:** Batch sırasında performans darboğazı.
`,
  { changedPaths: FIELD_CHANGED }
);
const pathLineHits = (deduped.findings || []).filter(
  (f) =>
    /InstantIncomingCTPSParser\.java$/i.test(f.path) && Number(f.line) === 120
);
assert.strictEqual(pathLineHits.length, 1, "aynı path:line tek finding");
assert.ok(
  deduped.dropped.some((d) => d.reason === "duplicate_path_line") ||
    pathLineHits.length === 1,
  "duplicate_path_line"
);

console.log("findingGate tests OK");
