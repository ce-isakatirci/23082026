# PR Reviewer Quality + LLM Efficiency Design

**Date:** 2026-09-20 (v1 contract) · **Replay:** 2026-09-21 (v2 contract)  
**Extension:** `ykb-pr-reviewer-extended`  
**Field sample:** Bitbucket PR #3170 (COSSEPA/cosmos-sepa) — MONYFEST-3667 / MONYFEST-3886 SEPA Message Inquiry APIs  
**Ground truth diff:** `C:\Users\U0102292\IdeaProjects\cosmos-sepa\pr.diff` (23 path, +849/−6, 29 hunk)  
**Model under test:** `qwen3` (`cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit`) — **sabit; yeni provider yok**  
**Status:** v1 **Implemented** 2026-09-20. v2 **Implemented** 2026-09-21.

### Implementation note (2026-09-20) — v1 shipped, do not revert

Shipped in extension tree (keep; v2 tightens, does not rip out):

- `out/findingGate.js` + `test/findingGate.test.js`
- Wire: `reviewRunner` gates after merge; `prComment` severity stamp; `config.findingGateEnabled`
- Prompt: compact `ykb-domain-rules.md` / `output-format.md`; stub using-superpowers; `includeSkillsOnFindingsOnly=false`
- Related denylist + bridge Critical shrink
- Settings: `findingGate.enabled`, `prompt.includeSkillsOnFindingsOnly`, `contextExpansion.relatedPathDenylistSegments`

### Implementation note (2026-09-21) — v2 shipped

v1 gate **saha metnine dar**dı. Replay (`review-#3170-…T11-48-41.md` + `inline-review.mhtml` + bağımsız Faz 0) posted Critical’ın %75’inin oversevere olduğunu gösterdi. v2 **yeni essay prompt yazmaz**.

Shipped:

- `findingGate`: `evidenceHaystack` (Issue+Why); Suggested “unique constraint önerilir” ≠ proof; `incomplete_xxe`; `calendar_local_instance`; `jpa_criteria_join_nplusone`; `wrong_hunk_wr_entity`; `nitpick`; path:line dedupe
- `reviewPack.mergeChunkReviews` File: path:line unique; `mergeInquiryEntityUnits`
- `inquiryEntityBridge.js` + `expandReviewContext` allowlist snippet
- `prComment.resolveInlineComments` severity-priority before cap 20
- `buildAssistantPrompt({ compactRules })` + `prompt.compactFindingsOnly` (default true); `reviewRunner` i>0 compact
- Prompt checklist +4 satır; `output-format.md` yaz/yazma/düşür saha örnekleri
- Rollback: `findingGate.enabled=false`; `compactFindingsOnly=false`

---

## 1. Goal

Extension her PR’da **doğru, tutarlı, az gürültülü** review üretsin; Qwen/Copilot yolunu **en az token / en yüksek sinyal** ile kullansın.

Kök sorun model değil: prompt/pack/chunk/severity/post pipeline modeli yanlış kullanıyor. Çözüm yalnızca extension’da (prompt md, skill, packer, budget, comment post, related context, **machine findingGate**).

## 2. Non-goals

- PR #3170’i veya cosmos-sepa’yı düzeltmek
- Yeni model / yeni provider eklemek (mevcut Qwen / Copilot yolu kalır)
- UI redesign, unrelated refactor, VSIX packaging (bu spec oturumunda kod da yok)
- Temperature’ı birincil “fix” saymak
- graphify/codegraph’ı extension içine gömmek
- Suggested-code derleme / Java parser
- Gate’in CLOB / always-join / first-child / authz bulgusunu **uydurması** (yalnız pack + checklist; model yine yazmazsa miss kalır — §14 risk)
- Eski “Code Review Assistant” comment’lerini (Bitbucket id 2440557–2440582) skorlamak
- `MAX_INLINE_COMMENTS` 20’yi tek başına yükseltmek (önce gürültü drop)

## 3. Field evidence — v1 snapshot vs v2 replay

### 3.1 Sources (v2 freeze)

| Source | Role |
|--------|------|
| `cosmos-sepa/pr.diff` | Canonical changed-path + hunk list (23 path) |
| cosmos-sepa CodeGraph + graphify (2026-09-21 update) | Semantik doğrulama (Faz 0 bağımsız) |
| `cosmos-sepa/review-#3170-…T11-48-41.md` | Extension md after findingGate v1 (12 chunk, ~37 blok, Needs work) |
| `cosmos-sepa/inline-review.mhtml` | Posted Bitbucket (AI Review Assistant 2443002–2443066) |
| v1 spec §3 (T19 / eski snapshot n=13) | Tarihsel; **skor kaynağı değil** |

İkinci md `…T19-38-41.md` drift için; asıl kanıt T11-48-41 + MHTML + `pr.diff`.

### 3.2 Verdict (v2)

**Production-ready reviewer değil; gürültü jeneratörü.** v1 sonrası iyileşme var: `pageSize` Important yakalandı; Criteria-NPE ve factory-share bu sette yok. Kök neden Qwen zayıflığından çok **gate delikleri + chunk parçalanma + 20 inline cap**. Prompt zaten TOCTOU/XXE Important ve nitpick/Path.get NPE yasağı yazıyor; Qwen 4bit yok sayıyor → **makine şart**.

Posted unique (AI Review Assistant): **16** + 1 duplicate CTPS TOCTOU. Eski “Code Review Assistant” ayrı bot — extension skoruna **katılmaz**.

### 3.3 Label counts (posted unique n=16)

| Label | Count | IDs (Appendix A) |
|-------|------:|------------------|
| TRUE_POSITIVE | 3 | E3 orphanRemoval, E16 pageSize, E6 prettyPrint XXE |
| TRUE_BUT_OVERSEVERE | 3 | E1 CTPS TOCTOU, E2 CTRJ TOCTOU, E4 decode XXE |
| FALSE_POSITIVE | 3 | E5 Calendar, E13 Criteria N+1, E23 WR entity on new query |
| NOISE | 7 | E11 statuses @Transactional, E12 List OOM, E14 OR index, E17 mapSort default, E18 DataPDU debug, E19 BASE64 regex, E21 gereksiz else |
| TRUE_BUT_OUT_OF_SCOPE | 0 posted | md’de service-bypass spekülasyonu snapshot’ta yok |
| UNVERIFIABLE | 0 | — |
| MISS (Faz 0 P0-sınıfı) | 4 | R1 CLOB, R3 always-join, R4 heap/size gate, R8 first-child (+ authz checklist residual) |
| OVERREACH | 13 | OVERSEVERE + FP + NOISE |

Aynı `path:line` md blokları (E7 N+1 findBy CTPS:120, CTRJ stream/bypass) post `seen` ile TOCTOU’ya çöker; md envanterinde durur.

**precision** ≈ 3 / (3+3+7) = **23%** — TP / (TP+FP+NOISE).  
**recall** ≈ 2 / 8 = **25%** — doğru severity ile yakalanan Faz 0 ref (R2 pageSize, R6 orphan); oversevere sayılmaz.  
**Posted Critical kalitesi:** 4 unique Critical’tan 1 TP (orphan), 3 oversevere → **75% bozuk Critical**. v1 hedefi ≤23% — **kaçırıldı**.

Md vs snapshot: md ~37 blok; `MAX_INLINE_COMMENTS=20` + `findAnchor` miss → Minor’ların çoğu ve bazı Important’lar Bitbucket’a gitmemiş. Duplicate CTPS (2443066 genel + 2443034 inline) ikinci koşu veya merge-tekrarı.

### 3.4 v1 vs v2 (neden yeni sözleşme)

| | v1 field (eski snapshot n=13) | v2 replay (posted n=16) |
|--|-------------------------------|-------------------------|
| Gate | yok / henüz saha görmemiş | var; TOCTOU Suggested “unique constraint önerilir” ile deliniyor |
| Criteria Path NPE Critical | FP posted | bu sette yok (gate + kart işe yaradı) |
| factory share Critical | FP posted | bu sette yok |
| pageSize | MISS | TP Important |
| CLOB list hydration | MISS (DTO tipine Critical) | hâlâ MISS |
| Posted bad Critical | ~85% | **75%** (hedef ≤23% kaçtı) |

---

## 4. Faz 0 — Referans Review (bağımsız, `pr.diff` + cosmos-sepa)

Diff path seti (23): `.gitignore`; `InstantIncomingCTPSParser.java`; `InstantIncomingCTRJParser.java`; `IncomingCTPSParser.java`; `IncomingCTRJParser.java`; `CommonParserServiceImpl.java`; `IncomingMessageMasterEntity.java`; `IncomingMessageMasterRepository.java`; `IncomingMessageRepositoryWR.java`; `MessageTypeRepository.java`; `OutgoingMessageMasterRepository.java`; `MessageInquirySpecs.java`; `MessageTypeEntityDto.java`; `InquiryMessageResponseDTO.java`; `MessageContentDTO.java`; `MessageDownloadDTO.java`; `MessageInquiryQueryRequestDTO.java`; `MessageInquiryRowDTO.java`; `ServiceLocator.java`; `MessageInquiryService.java`; `XmlContentResolver.java`; `MessageInquiryController.java`; `InstantIncomingCTRJParserTest.java`; `XmlContentResolverTest.java`.

Yeni yüzey: `MessageInquiryController` / `MessageInquiryService` / `XmlContentResolver` / `MessageInquirySpecs` + parser idempotency + `orphanRemoval=true`.

| ref_id | severity | file:line (diff sonrası) | issue | diff hunk? | neden risk |
|--------|----------|--------------------------|-------|------------|------------|
| R1 | Important | `MessageInquiryService.java` `searchIncoming` ~65–69 + `IncomingMessageMasterEntity.java` `@Lob xmlData` 56–58, EAGER `incomingMessages` 86–88 | Liste API CLOB + child graph yükler | evet (yeni service; mapping mevcut) | Heap / DB I/O her satırda |
| R2 | Important | `MessageInquiryService.buildPageRequest` 219–224 | `pageSize` alt sınır var, **üst yok** | evet | DoS / bellek |
| R3 | Important | `MessageInquirySpecs.java` 31–34 / 73–76 | Filtre olmasa da LEFT JOIN message+tx + `distinct(true)` | evet | cartesian / pagination skew |
| R4 | Important | `XmlContentResolver.prettyPrintXml` 158–175 + `toContentDto`/`toDownloadDto` | CLOB→DOM, JSON `byte[]`/`String`, size gate yok | evet | Heap |
| R5 | Important | aynı resolver 127–174 | `disallow-doctype-decl` var; `FEATURE_SECURE_PROCESSING` ve Transformer `ACCESS_EXTERNAL_*` yok | evet | Residual XXE; classic XXE büyük ölçüde kapalı → **Critical değil** |
| R6 | Critical | entity `orphanRemoval=true` + `CommonParserServiceImpl` 554–559 `clear()` | Data-loss blast radius | evet | CTPS/CTRJ early-return kısmi mitigasyon |
| R7 | Important | Instant CTPS/CTRJ exists/find-then-save | `incoming_message.master_id` unique kanıtı yok → duplicate satır | evet | UniqueKeyViolation **spekülatif**; Critical değil |
| R8 | Important | `firstIncomingMessage` / `firstOutgoingMessage` `get(0)` | Bulk satırda yanlış BIC/E2E/ref | evet | Yanlış inquiry row |

**INFO_PREEXISTING (bot Critical yazmamalı):** method-security yok — `OutgoingTransactionController` aynı ev stili. v2 checklist kararı: **Important “method-security kanıtı yok” yaz** (exploit uydurma). Gate bu bulguyu **eklemez**.

**Yazılmayacak (LLM tuzağı):** Criteria `Path.get` runtime NPE; local `Calendar.getInstance()` thread-safety; `DocumentBuilderFactory.newInstance()` per-call unsafe; `OutgoingMessageMasterEntityWR` satırı yeni `findDistinctMessageStatuses` query’sinde değil (pre-existing `setSenderReference` L30). IncomingTransaction `FetchType.EAGER` → klasik N+1 değil; R1/R3 bellek/join.

---

## 5. Success metrics (measurable, #3170 freeze)

Replay harness: same PR #3170 pack (veya frozen pack fixture) + same model settings; karşılaştırılan **gated + posted** çıktı, ham model prose değil.

| # | Metric | v1 hedefi (eski n=13) | v2 baseline (posted n=16) | v2 target |
|---|---------|----------------------|---------------------------|-----------|
| 1 | FP + oversevere among **posted Critical** | ≤3/13 (~23%) | **3/4 (75%)** | **≤1/4** — yalnız R6 orphan Critical kalabilir; TOCTOU+XXE Important |
| 2 | MISS P0 capture as correct severity | ≥2 of 4 Important | R2 var; R1/R4/authz yok | **R1 CLOB Important** (yeni pack), **R2 pageSize Important** (zaten var), **R5 XXE Important** (E6 kalır, E4 düşer), **R6 Critical**. Authz: Important “kanıt yok” **veya** bilinçli yazıldı. ref_id eşlemesi: R1,R2,R5,R6 |
| 3 | Findings-only kural gövdesi | ≤2.5KB her chunk | tüm chunk’larda full domain (`includeYkbDomainRules`) | **chunk 0** full findings-only (skills kapalı); **i>0** assistant kural gövdesi **≤ ~1.2KB** (preamble + severity map + 8 satır denylist + outputLock). Ölçüm: mevcut `assistantChars` log; i>0 için ayrı log alanı `assistantCharsCompact` |
| 4 | Replay tutarlılık | gated Critical path:line Jaccard ≥ 0.7 | T11 vs MHTML drift (cap 20) | Gated Critical path:line Jaccard **≥ 0.7** iki ardışık koşu; posted set cap sonrası severity sırası sabit |
| 5 | Pack out-of-diff path oranı | (v1 ölçülmedi) | related batch denylist inquiry’de 0 hedefi vardı; **changed** parser ayrı chunk (diff’te gerçek) | `role=related` ∩ denylist segment / tüm pack path = **0** inquiry+parser karışık PR’de. Allowlist entity snippet **istisna** (diff’te olmayabilir). Ölçüm: pack log `relatedPaths` vs `pr.diff` path set |

precision hedefi (aynı n=16 tanımlı): **≥ 70%** TP / (TP+FP+NOISE) — NOISE 7→≤2, FP 3→0, OVERSEVERE Critical 0 (Important olarak kalabilir).

---

## 6. Current architecture (one page, post-v1)

```text
Bitbucket PR diffs
    → collectReviewFiles (isReviewablePath; unit tests skipped)
    → contextExpansion.resolveRelatedPaths (codegraph callers + co-location score
         + relatedPathDenylistSegments when inquiry changed)
    → attachFileContents
    → buildAssistantPrompt ×2 (full + findingsOnly); findingsOnly hâlâ language+scope+domain+expansion
    → fitFileBudget(maxPromptChars − max(systemFull, systemFindings) − chrome)
    → packReviewChunks (changed units; related assigned to owner; overflow → yeni chunk; skippedPaths=[])
    → findingsOnly := chunkCount>1
    → her chunk AYNI assistantText (12× domain)
         + user: diffs + bodies + bridge (Critical one-liner, 600 chars)
    → LLM (Qwen / Copilot)
    → mergeChunkReviews (heading concat, path:line dedupe YOK)
    → gateReviewMarkdown(changedPaths = role!==related)
    → prComment.resolveInlineComments (document order, path:line seen, cap 20)
    → overview Critical comment (gated Critical body)
```

Key modules:

| Module | Responsibility today |
|--------|----------------------|
| `out/promptConfig.js` | `buildAssistantPrompt({ findingsOnly })`; skills skip on findings-only; `extractSeverityMap`; `outputLock` |
| `out/reviewBudget.js` | `fitFileBudget` |
| `out/reviewPack.js` | Pack; bridge; `mergeChunkReviews` concat |
| `out/contextExpansion/*` | Callers, denylist, unit-test skip |
| `out/reviewRunner.js` | Pack → LLM → merge → **gate**; tek `assistantText` tüm chunk’lara |
| `out/findingGate.js` | Parse / drop / downgrade / rebuild |
| `out/prComment.js` | path:line; severity stamp; **MAX_INLINE_COMMENTS=20** document-order |
| `out/unitTestPath.js` | Skip `src/test/**` |

Prompt defaults: `includeSkillsOnFindingsOnly: false`, `includeYkbDomainRules: true` (findings-only dahil).

---

## 7. Root causes (v2 replay) — symptom → file → mechanism → spec fix

```text
diff → packReviewChunks → Qwen per chunk → merge concat → findingGate → prComment cap 20
```

| # | Symptom | File / symbol | Mechanism | v2 fix |
|---|---------|---------------|-----------|--------|
| 1 | TOCTOU hâlâ Critical | `findingGate.haystack` + `claimsUniqueConstraintProof` | Haystack Issue+Why+**Suggested** birleştirir. Suggested “unique constraint + OptimisticLock **önerilir**” → proof true. Test Why’da “unique constraint **yok**” kullanıyor — saha kaçıyor. `output-format.md` / `ykb-domain-rules.md` zaten Important diyor. | P0: proof **yalnız Issue+Why**. “önerilir/should/add unique” ≠ kanıt |
| 2 | decode XXE Critical | `findingGate.classifyFinding` | Domain “incomplete XML → Important”; gate’te XXE kuralı yok. Metin açıkça `disallow-doctype` diyor. | P0: `disallow-doctype` veya `setExpandEntityReferences(false)` geçiyorsa Critical→Important (`incomplete_xxe`) |
| 3 | Calendar thread-safety FP | aynı; anti-hallucination yalnız NPE+factory | `startOfDay` her çağrıda `Calendar.getInstance()` — shared mutable değil | P0: drop `calendar_local_instance` |
| 4 | Criteria `Path.get` N+1 FP | `isCriteriaPathNpeClaim` yalnız NPE | Join Path ≠ N+1 | P0: drop `jpa_criteria_join_nplusone` |
| 5 | WR entity yeni DISTINCT query | hunk-claim yok | `OutgoingMessageMasterRepository` L32 vs pre-existing WR UPDATE L30 | P0: drop `wrong_hunk_wr_entity` (repository non-WR + Issue `EntityWR` + DISTINCT) |
| 6 | Nitpick posted (else, FQN, regex…) | `scope-rule.md` yasak; gate drop etmiyor | Model Minor/Important yazar; cap 20 kotayı doldurur | P0: drop `nitpick` |
| 7 | CLOB miss (R1) | `reviewPack.buildPackUnits` + related denylist | Co-location **aynı klasör**. Service `…/messageinquiry/`, entity `…/dao/entity/` → ayrı unit/chunk. Denylist batch related keser (doğru); entity snippet yok. Checklist var, model `@Lob` görmeden XXE’ye kayıyor. Gate miss **eklemez**. | P1: allowlist pair aynı chunk, max 80 satır mapping |
| 8 | R3/R4/R8 miss | checklist yok (R3/R8); R4 model XXE’ye kaydı | — | P1: 4 satır checklist; pack R4 için resolver zaten chunk’ta — size-gate kartı |
| 9 | 12× domain token | `reviewRunner.js` ~421–423; `buildAssistantPrompt` | `chunkCount>1` iken **tüm** chunk `promptFindings`; yine language+scope+expansion+**tam** `ykbDomainRules`. Skills kapalı (iyi). `fitFileBudget` system’i `max(full,findings)` düşer. | P2: i>0 `compactRules` |
| 10 | Duplicate / cap drift | `mergeChunkReviews` concat; `resolveInlineComments` seen+cap | Merge path:line unique değil. Cap document-order: Critical/Important gürültü kotayı doldurur, Minor düşer; sinyal öncelikli değil. | P0 merge dedupe; P1 cap severity sort |

**Sonuç:** v1 doğru teşhis (machine gate). v1 implementasyonu saha string’ine dar. **Yeniden uzun essay yok.**

---

## 8. Chosen approach (v2)

**Sıkı machine gate (saha fixture) + compact findings-only i>0 + inquiry-entity pack unit + severity-priority post cap.**

Model/provider unchanged. Prompt’a en fazla 4 satır checklist. FP/oversevere **parse sonrası** düşer. Related: `pack path ⊆ diff path ∪ allowlisted related`.

---

## 9. Required changes by priority

### P0 — False-positive / severity (ship first)

#### 9.1 `out/findingGate.js` — tighten, do not rewrite architecture

Mevcut `ReviewFinding` typedef ve `gateReviewMarkdown(markdown, { changedPaths, enabled })` API **kalır**. `dropped` / `downgraded` reason string’leri v1 ile uyumlu kalır; yenileri eklenir.

**Haystack split (zorunlu):**

```js
function evidenceHaystack(finding) {
  return [finding.issue, finding.why].join("\n").toLowerCase();
}
function fullHaystack(finding) {
  return [finding.issue, finding.why, finding.suggested, finding.rawBlock]
    .join("\n").toLowerCase();
}
```

- `claimsUniqueConstraintProof` **yalnız `evidenceHaystack`**. Suggested/rawBlock yok.
- Negatif: `unique constraint (yok|eksik|missing)|no unique|without unique|önerilir|should add|add unique|kullanımı önerilir` → proof **false**.
- Pozitif (Issue/Why’da, negatif yokken): mevcut satırın DB’de unique/index/`@Version`/pessimistic **olduğu** iddiası (`var`, `mevcut`, `already has`).

**Yeni / genişleyen machine rules (classifyFinding, existing order’dan sonra Critical bloğunda; drop’lar severity bağımsız):**

1. Mevcut: malformed, `out_of_diff`, `unit_test_noise`, `jpa_criteria_path_npe`, `factory_thread_safety_inverted`, `pathvariable_notnull_noise`, `dto_base64_contradiction` — **kalır**.
2. **`jpa_criteria_join_nplusone` drop** — text Criteria/`root.get`/`Path.get`/`MessageInquirySpecs` **ve** (`n+1` / `n + 1` / `N+1 sorgu`) **ve** NPE claim yok (NPE zaten kural 1).
3. **`calendar_local_instance` drop** — `Calendar` + (`thread-safe değil` / `thread-safety` / `race`) + (`getInstance` / `startOfDay` / `endOfDay` / `static`). Shared static field Calendar iddiası (`static final Calendar` / `paylaşılan instance`) drop **değil** (gerçek bug bırak).
4. **`wrong_hunk_wr_entity` drop** — path `OutgoingMessageMasterRepository.java` (WR değil) **ve** issue/why `OutgoingMessageMasterEntityWR` / `EntityWR` **ve** (`distinct` / `findDistinctMessageStatuses` / `SELECT DISTINCT`).
5. **`nitpick` drop** — issue/why eşleşmesi (case-insensitive): `gereksiz else`, `kod tekrarı` / `duplication` (işlevsel bug yok: `stream().findFirst`, FQN import, `immutable` DTO, `boolean` vs `Boolean` flag, `javax.xml` import, `Pattern` import gerekli). **İstisna:** `clear()` + `orphanRemoval` / data loss içeren blok nitpick değil.
6. **`incomplete_xxe` Critical→Important** — severity Critical **ve** (`xxe` / `xml external` / `entity expansion`) **ve** (`disallow-doctype` / `disallow-doctype-decl` / `setExpandEntityReferences(false)`). FEATURE_SECURE_PROCESSING eksikliği Important kalır (R5).
7. Mevcut Critical downgrade: `race_without_constraint` (artık Suggested delinmez), `orphan_clear`, `redundant_bean_validation`, `dto_type_style` — **kalır**. `isOrphanClearCriticalWorthy` (`orphanRemoval=true` **ve** `clear(`) Critical keep — **kalır** (R6 / E3).
8. **path:line dedupe (gate çıktısı)** — `kept` üzerinde key = `normalizePath + ':' + line`. Çakışmada **yüksek severity** kazanır (Critical > Important > Minor). Aynı severity: birincisi kalır, diğeri `dropped` `reason: duplicate_path_line`. Merge öncesi de `reviewPack.mergeChunkReviews` aynı key ile tekilleştirir (çift katman: merge sonra gate; ikisi de idempotent).

`rebuildMarkdown` davranışı aynı (Özet/Güçlü yönler korunur; boş severity heading yok; Sonuç gated Critical’a göre).

**Gate CLOB/authz/join/first-child uydurmaz.**

#### 9.2 `test/findingGate.test.js` — saha fixture

Mevcut S6/S10/S1/S5/unit-test/out_of_diff testleri **kalır**. Eklenenler (T11-48-41 metnine yakın; Suggested içinde “unique constraint … önerilir” **birebir**):

1. CTPS TOCTOU Critical + Suggested `// DB level unique constraint + OptimisticLock ... önerilir` → **Important**, `race_without_constraint`. Why’da “yok” olmasa bile.
2. decodeDocument XXE Critical, Why `disallow-doctype-decl ... mevcut` → **Important**, `incomplete_xxe`.
3. prettyPrint XXE **Important** (disallow eksik veya residual FEATURE) → **Important kalır** (drop yok).
4. Calendar `startOfDay` thread-safety Important → **drop** `calendar_local_instance`.
5. Specs:43 `root.get("messageTypeDefinition").get("id")` N+1 (NPE yok) → **drop** `jpa_criteria_join_nplusone`.
6. Criteria NPE hâlâ drop (regresyon).
7. `OutgoingMessageMasterRepository.java:32` EntityWR + DISTINCT → **drop** `wrong_hunk_wr_entity`.
8. CommonParser 554 “Gereksiz else” Minor, `clear()` var ama issue nitpick — **drop** `nitpick`. Aynı dosyada orphanRemoval+clear Critical **keep**.
9. İki blok aynı `InstantIncomingCTPSParser.java:120` (TOCTOU + N+1) → tek finding, Critical/Important kuralları sonrası tek satır.
10. orphanRemoval+clear Critical **keep** (regresyon).

#### 9.3 Prompt: en fazla 4 satır checklist — **yeni essay yok**

`prompt/ykb-domain-rules.md` `[INQUIRY / REST checklist — Important]` altına **yalnız**:

```text
- Liste/search: `@Lob` / `xmlData` / EAGER child graph aynı entity’de varsa Important (DTO tipi değil yük).
- Specification: filtre yokken de JOIN + `distinct(true)` → cartesian / pagination skew Important.
- Row mapping `list.get(0)` / first-child BIC/E2E/ref → bulk’ta yanlış kolon Important.
- `Calendar.getInstance()` metod-lokal = thread-safety bulgusu yazma.
```

`prompt/output-format.md` örnekleri:

- **Yaz (Critical):** E3 / R6 orphanRemoval+clear (zaten var).
- **Yaz (Important):** E16 / R2 unbounded pageSize; R1 `@Lob` list hydration (yeni örnek, 4 satır).
- **Yazma:** E5 Calendar; E13 Criteria N+1; E23 WR yeni query; E21 gereksiz else; Suggested’da unique constraint önermek TOCTOU’yu Critical yapmaz.
- **Düşür:** E1/E2 Critical→Important; E4 Critical→Important (`disallow-doctype` mevcut).

Skills (`skills/requesting-code-review/*`) **dokunulmaz** (zorunlu değil). `scope-rule.md` zaten nitpick yasak.

### P1 — Miss capture + packer + post cap

#### 9.4 Inquiry-entity pack unit

**Sözleşme:** `pack path ⊆ diff path ∪ allowlisted related`.

`relatedResolver.js` denylist v1 **kalır** (inquiry changed iken `batch/sepaincoming`, `batch/instantpayments`, `batch/instantpaymentsoutgoing`, `batch/embargo` related drop; **changed** parser pack’te kalır).

**Yeni allowlist pair** (`out/contextExpansion/inquiryEntityBridge.js` yeni küçük modül **veya** `relatedResolver.js` + `reviewPack.js`):

Değişen path `MessageInquiryService.java` veya `MessageInquiryController.java` veya `XmlContentResolver.java` içeriyorsa, pack’e **related** olarak ekle (denylist dışı, unit-test skip durur):

- `src/main/java/com/ykb/nl/sepa/dao/entity/IncomingMessageMasterEntity.java`
- `src/main/java/com/ykb/nl/sepa/dao/entity/OutgoingMessageMasterEntity.java`

İçerik: tam dosya değil; **mapping snippet max 80 satır** — `@Lob` / `xmlData` / `@OneToMany` / `FetchType` / `orphanRemoval` / `incomingMessages` / `outgoingMessages` civarı. Dosya diff’te zaten varsa (Incoming master #3170’te var) ikinci kopya yok; **aynı pack unit** `MessageInquiryService` ile (owner = inquiry service path, `buildPackUnits` assignment force).

`maxRelatedFileChars` snippet’i keserse `@Lob` satırları öncelikli (ilk 80 satır kör kesilmesin: entity’de xmlData ~L56, collection ~L86 — snippet bu aralığı **kapsamalı**).

Test: `test/reviewPack.test.js` — inquiry service + iki entity same chunk; denylist parser related yok; changed parser ayrı unit olabilir.

#### 9.5 `mergeChunkReviews` path:line unique

`joinedHeadingBodies` sonrası parse (`findingGate.parseFindings`) veya eşdeğer path:line collapse. Çıktı markdown tekilleşmiş bloklar. Gate ikinci kez aynı key’i drop eder (`duplicate_path_line`) — test: merge iki chunk aynı CTPS:120 → tek blok.

#### 9.6 `prComment.js` — cap severity-priority

`MAX_INLINE_COMMENTS = 20` **kalır** (yükseltme yok).

`resolveInlineComments`: `extractPathLineRefs` sonrası sort:

1. severity: Critical, Important, Minor
2. aynı severity: document order

Sonra `seen` path:line, `findAnchor`, **sonra** cap 20.

Böylece nitpick Minor kotayı doldurup pageSize/orphan kaçırmaz. Gate zaten nitpick drop eder; bu katman defense-in-depth.

Genel overview: yalnız gated Critical (v1). Inline stamp severity (v1).

### P2 — LLM token efficiency

#### 9.7 Prompt layers (somut)

| Layer | When | Contents | Target size |
|-------|------|----------|-------------|
| A — Full system | `findingsOnly=false` (tek chunk) | v1: stub skills + language + scope + expansion + domain card + output format + outputLock | ≤5KB md (v1) |
| B0 — Findings-only chunk 0 | `findingsOnly=true`, `compactRules=false` | Skills yok (`includeSkillsOnFindingsOnly` default false). language + scope + expansion + **tam** domain + findings-only format + severity map + chunk note + outputLock | v1 ≤2.5KB kural; pratikte domain+scope bugün daha büyük olabilir — **küçültme hedefi i>0** |
| B1 — Compact i>0 | `findingsOnly=true`, `compactRules=true` | `systemPreamble` + `extractSeverityMap(outputFormat)` + 8 satır denylist (aşağı) + findings-only `outputLock`. **ykb-domain, language, scope, expansion, extraInstructions, skills yok** | **≤ ~1.2KB** |
| C — User | Every chunk | PR meta + diffs + file bodies + related + bridge + chunk reminder | `fitFileBudget` |

**8 satır denylist (B1, sabit string `promptConfig.COMPACT_FINDINGS_DENYLIST` veya `prompt/findings-only-compact.md` ≤8 satır):**

```text
Critical yalnız: breaking, PII, orphanRemoval=true+clear(), bozuk işlev.
TOCTOU / XXE (disallow-doctype mevcut) → Important, Critical değil.
Yazma: Criteria Path.get NPE veya N+1; lokal Calendar thread-safety; factory share; gereksiz else; Diff dışı.
Önceki chunk bulgusunu kopyalama veya yeniden Critical yapma.
```

**`buildAssistantPrompt(cfg, extra, { findingsOnly, compactRules })`:**

- `compactRules===true` → B1; diğer include flag’leri yok sayılır (preamble + map + compact md + lock).
- `compactFindingsOnly` default **true** (`prompt/defaults.json` + settings `ykbPrReviewerExtended.prompt.compactFindingsOnly`). false → v1: her findings-only chunk B0.

**`reviewRunner.js`:** chunk döngüsünde

```js
const assistantText = findingsOnly
  ? buildAssistantPrompt(cfg, extra, {
      findingsOnly: true,
      compactRules: compactFindingsOnly && i > 0,
    })
  : promptFull;
```

`systemChars` bütçe: hâlâ `max(promptFull, promptFindingsB0)` — **küçültme file budget’ı artırmaz i>0’da** (bilinçli: pack boyutu chunk 0’a göre). Kazanç: i>0 **LLM input** token. Log:

```js
assistantChars, assistantCharsCompact, compactRules
```

`fitFileBudget` formülü değişmez.

### P3 — Format

- Severity map tek kaynak: `output-format.md` (v1).
- Compact dosya varsa map’i tekrar etmez; `extractSeverityMap` inject.
- `outputLock` findings-only heading kümesi aynı.

---

## 10. LLM efficiency design (contract)

### 10.1 Token bütçe payı (`maxPromptChars`, dokümantasyon)

| Bucket | Pay |
|--------|-----|
| System (chunk 0) | ≤ 25% after compact domain (ölç `systemChars`) |
| System (i>0 compact) | ≤ 1.2KB kural (~2–4% typical 32k char budget) |
| User chrome | ≤ 10% |
| Diffs | ≥ 40% |
| File contents + related | remainder; related `maxRelatedFileChars`; allowlist entity ≤80 satır |

### 10.2 Related

- Denylist v1.
- Allowlist entity pair §9.4.
- Unit-test skip durur.
- `pack path ⊆ diff path ∪ allowlisted related`.

### 10.3 Severity: hatırlatma yetmez

Gate zorunlu. Prompt kartı Qwen’e örnek; **karar makine**.

### 10.4 Duplicate / out-of-diff / unresolved

- out_of_diff: path ∉ changedPaths (related-only finding drop) — v1.
- duplicate_path_line: merge + gate.
- Unresolved-symbol spekülasyon: prompt yasağı; gate yeni kural yok (UNVERIFIABLE 0 bu sette).

### 10.5 Qwen 4bit

v1 kartı yeterli. **Yeni essay yok.** Gate testlerine saha cümleleri.

---

## 11. Files to change (implementation phase — ayrı onay)

| File | Responsibility |
|------|----------------|
| `out/findingGate.js` | haystack split; XXE/Calendar/Criteria-join/nitpick/WR-hunk/dedupe |
| `test/findingGate.test.js` | T11 Critical TOCTOU Suggested fixture + §9.2 listesi |
| `out/promptConfig.js` | `buildAssistantPrompt({ findingsOnly, compactRules })`; compact denylist |
| `out/reviewRunner.js` | i>0 compact; log `assistantCharsCompact`; gate reasons zaten var — reason çeşitlerini logla |
| `out/reviewPack.js` | merge path:line unique; inquiry-entity same unit |
| `out/contextExpansion/relatedResolver.js` ve/veya yeni `inquiryEntityBridge.js` | allowlist pair + snippet |
| `out/contextExpansion/config.js` | gerekirse `inquiryEntityBridge` flag okuma; **yeni setting zorunlu değil** |
| `out/prComment.js` | cap öncesi severity sort |
| `prompt/ykb-domain-rules.md` | +4 satır checklist |
| `prompt/output-format.md` | yaz/yazma/düşür örnekleri saha id’leri |
| `prompt/findings-only-compact.md` | yeni, ≤8 satır **veya** JS sabiti (tek yer) |
| `prompt/defaults.json` | `compactFindingsOnly: true` |
| `package.json` contributes.configuration | `prompt.compactFindingsOnly` |
| `settings.example.json` | sync |
| `test/promptConfig.test.js` | i>0 compact: `SEVERITY GATE` essay yok, map var, `assistant` ≤ ~1.2KB kural |
| `test/reviewPack.test.js` | inquiry+entity same chunk; merge dedupe |
| `test/prComment.test.js` | Critical/Important cap’te Minor’dan önce |
| `test/contextExpansion/relatedResolver.test.js` | denylist regresyon + allowlist entity |

**Do not change:** cosmos-sepa; bu spec path’i dışında plan dosyası; UI webview HTML (settings form auto-list hariç); skills gövdesi zorunlu değil.

---

## 12. Behavior contract (#3170 gerçek comment + Faz 0 miss)

| Case | After v2 gate + pack | Severity |
|------|----------------------|----------|
| E3 / R6 `orphanRemoval=true` + managed `clear()` | **Write** | Critical |
| E16 / R2 unbounded `pageSize` | **Write** | Important |
| R1 search `@Lob` hydration | **Write** (packer entity snippet + checklist; gate uydurmaz) | Important |
| E6 prettyPrint residual XXE | **Write** | Important |
| E4 decode XXE + disallow-doctype mevcut | **Düşür** | Important (`incomplete_xxe`) |
| E1 / E2 / R7 TOCTOU, Suggested “unique önerilir” | **Düşür** | Important — **Critical yazma** |
| R5 incomplete XXE (özet) | Write | Important never Critical |
| R3 always-join | **Write** (checklist; gate uydurmaz) | Important |
| R8 first-child | **Write** (checklist; gate uydurmaz) | Important |
| Authz no `@PreAuthorize` | **Write** Important “method-security kanıtı yok” (checklist; gate uydurmaz) | Important |
| E5 Calendar thread-safety | **Do not write** | drop |
| E13 Criteria N+1 | **Do not write** | drop |
| E23 WR entity on DISTINCT query | **Do not write** | drop |
| E21 gereksiz else | **Do not write** | drop |
| E11–E12, E14, E17–E19 nitpick/perf style | **Do not write** | drop |
| Criteria Path.get NPE (v1 S6) | **Do not write** | drop |
| factory newInstance share (v1 S10) | **Do not write** | drop |
| unit-test path | **Do not write** | drop |

Suggested code: kept findings’te hâlâ gerekli. Critical/Important boş Suggested → v1: non-security ise Minor (`missing_suggested`) **yalnızca o kural zaten yoksa ekleme**; data-loss Critical Suggested boş kalsa da Critical kalır.

---

## 13. Test strategy

Human runs (agent `npm` / `npx` çalıştırmaz):

```powershell
cd C:\Users\U0102292\ykb-pr-reviewer-extended
$env:HTTP_PROXY=$null; $env:HTTPS_PROXY=$null; $env:ALL_PROXY=$null; $env:http_proxy=$null; $env:https_proxy=$null; $env:all_proxy=$null; $env:NO_PROXY='*'; $env:no_proxy='*'
node --test test/findingGate.test.js test/prComment.test.js test/promptConfig.test.js test/reviewPack.test.js test/contextExpansion/relatedResolver.test.js
```

UI test yok.

**findingGate fixture (zorunlu):** T11-48-41 Critical TOCTOU bloğu — Issue/Why/Suggested CTPS:120 (Suggested içinde “unique constraint … önerilir”). Beklenen: markdown `## Important` altında TOCTOU, `## Critical` altında orphanRemoval, XXE decode Critical yok.

**promptConfig:** `compactRules: true` çıktısında `ykb-domain-rules` BREAKING CHANGE A–D gövdesi yok; `**Severity map:**` var; uzunluk ≤ 1200 + outputLock.

**reviewPack:** `MessageInquiryService` changed + entity allowlist → aynı `chunks[i].files`; related parser path yok.

Manual field check: PR #3170 replay; skoru §5 tablosuna işle (extension PR açıklaması, cosmos-sepa’ya commit yok).

---

## 14. Residual risk (bilinçli)

Gate CLOB/always-join/first-child/authz **üretmez**. Pack+checklist sonrası Qwen yine yazmazsa metric #2 kısmi fail — o zaman **üçüncü** turda (bu spec dışı) ya daha agresif snippet (xmlData satırını user chrome’a “İNCELE” satırı) ya da kabul edilen miss. Bu v2’de allowlist 80 satır + 4 satır checklist yeter varsayımı.

Suggested `List.findFirst()` derlenmez — Java compile gate yok (non-goal).

---

## 15. Rollback / compatibility

| Setting | Default | Rollback |
|---------|---------|----------|
| `ykbPrReviewerExtended.findingGate.enabled` | `true` | `false` → gate bypass (v0 gürültü) |
| `ykbPrReviewerExtended.prompt.includeSkillsOnFindingsOnly` | `false` | `true` → token-heavy skills |
| `ykbPrReviewerExtended.prompt.compactFindingsOnly` | `true` | `false` → v1: her findings-only chunk full domain |
| `ykbPrReviewerExtended.contextExpansion.relatedPathDenylistSegments` | batch segment listesi | `[]` → denylist off; allowlist pair kodda ayrı (inquiry service değişmişse entity yine eklenir) |
| Existing `includeSkills`, `includeYkbDomainRules`, `maxPromptChars` | unchanged | as today |

`prompt/defaults.json` aynı flag’ler. Bitbucket API sözleşmesi değişmez. Eski VSIX `compactRules` yok sayar (`options.compactRules` falsy → v1 prompt).

---

## 16. Implementation order (sonraki oturum, spec onayından sonra kod)

1. `findingGate.js` + saha testleri (P0) — TDD: kırmızı fixture, sonra kural.
2. `mergeChunkReviews` dedupe + test.
3. `prComment` severity-priority cap + test.
4. `promptConfig` compactRules + defaults/settings + test.
5. `reviewRunner` per-chunk assistant + log.
6. inquiry-entity allowlist + pack same-unit + relatedResolver regresyon.
7. 4 satır domain + output-format örnekleri.
8. #3170 replay; §5 metrik tablosunu extension değişikliğinin PR body’sine yaz.

Git commit yalnız kullanıcı isterse.

---

## Appendix A — Comment inventory (T11-48-41 md + posted)

Kaynak: md = T11-48-41; inline = MHTML AI Review Assistant; genel = overview Critical. `pr.diff`: path listede.

| id | sev md | file:line | issue | kaynak | diff? | label | ref |
|----|--------|-----------|-------|--------|-------|-------|-----|
| E1 | Critical | InstantIncomingCTPSParser.java:120 | find→save TOCTOU | md + inline + genel (dup) | hunk | TRUE_BUT_OVERSEVERE | R7 partial |
| E2 | Critical | InstantIncomingCTRJParser.java:145 | exists→save TOCTOU | md + inline | hunk | TRUE_BUT_OVERSEVERE | R7 partial |
| E3 | Critical | IncomingMessageMasterEntity.java:86 | orphanRemoval=true data loss | md + inline | hunk | TRUE_POSITIVE | R6 |
| E4 | Critical | XmlContentResolver.java:130 | decode XXE incomplete | md + inline | hunk | TRUE_BUT_OVERSEVERE | R5 |
| E5 | Important | MessageInquirySpecs.java:104 | Calendar thread-safety | md + inline | hunk | FALSE_POSITIVE | none |
| E6 | Important | XmlContentResolver.java:155 | prettyPrint XXE | md + inline | hunk | TRUE_POSITIVE | R5 |
| E7 | Important | InstantIncomingCTPSParser.java:120 | N+1 findBy | md (post seen collapse) | hunk | NOISE | none |
| E8 | Important | InstantIncomingCTPSParser.java:120 | unused mapping / update-if-exists | md | hunk | NOISE | none |
| E9 | Important | InstantIncomingCTRJParser.java:148 | stream findFirst | md | hunk | NOISE | none |
| E10 | Important | InstantIncomingCTRJParser.java:145 | service bypass | md | hunk | TRUE_BUT_OUT_OF_SCOPE | none |
| E11 | Important | IncomingMessageMasterRepository.java:47 | findDistinctStatuses @Transactional | md + inline | hunk | NOISE | none |
| E12 | Important | IncomingMessageRepositoryWR.java:20 | List OOM | md + inline | hunk | NOISE | none |
| E13 | Important | MessageInquirySpecs.java:43 | Path.get N+1 | md + inline | hunk | FALSE_POSITIVE | none (R3 missed) |
| E14 | Important | MessageInquirySpecs.java:50 | OR index | md + inline | hunk | NOISE | none |
| E15 | Important | MessageInquirySpecs.java:61 | BIC trim/case | md | hunk | NOISE | none |
| E16 | Important | MessageInquiryService.java:65 | pageSize üst yok | md + inline | hunk | TRUE_POSITIVE | R2 |
| E17 | Important | MessageInquiryService.java:166 | mapSort silent default | md + inline | hunk | NOISE | none |
| E18 | Important | XmlContentResolver.java:108 | DataPDU debug log | md + inline | hunk | NOISE | none |
| E19 | Important | XmlContentResolver.java:125 | BASE64 regex | md + inline | hunk | NOISE | none |
| E20 | Important | MessageInquiryController.java:44 | @Valid eksik | md + inline | hunk | NOISE / over-validation | none |
| E21 | Minor | CommonParserServiceImpl.java:554 | gereksiz else (`clear()` asıl risk) | md + inline | hunk | NOISE | R6 kaçan çerçeve |
| E22 | Minor | MessageTypeRepository.java:16 | FQN List | md | hunk | NOISE | none |
| E23 | Minor | OutgoingMessageMasterRepository.java:32 | JPQL EntityWR | md + inline | hunk | FALSE_POSITIVE | none |
| E24–E37 | Minor | Specs dup, DTO immutable, @Min, binaryBase64, ServiceLocator FQN, method dup, javax.xml import | md (çoğu cap dışı) | hunk | NOISE | none |

**Kanıt özeti (etiket gerekçesi):**

- **E3 TP:** entity L86 `orphanRemoval = true`; parser `clear()` 554–559 aynı PR. Why inquiry’yi suçluyor — çerçeve zayıf, severity doğru.
- **E16 TP:** `buildPageRequest` 219–224 min clamp, max yok.
- **E6 TP:** `prettyPrintXml` FACTORY_FEATURES disallow-doctype; Transformer `ACCESS_EXTERNAL_*` yok — Important doğru.
- **E1/E2 oversevere:** race gerçek (R7); unique constraint kanıtı yok; Suggested derlenmeyen `List.findFirst()`. Gate Suggested’ı proof sandı.
- **E4 oversevere:** Why `disallow-doctype` mevcut diyor; Critical kanon breaking/PII/data-loss değil.
- **E5 FP:** `startOfDay` lokal `Calendar.getInstance()` — paylaşılan mutable yok.
- **E13 FP:** Criteria `Path.get` join; N+1 değil; NPE de değil. R3 always-join kaçtı.
- **E23 FP:** L33 yeni `OutgoingMessageMasterEntity` DISTINCT; WR `setSenderReference` L30 pre-existing.

**MISS (ref ∩ yok / yanlış çerçeve):**

| miss | kanıt | pr.diff | extension eksiği |
|------|-------|---------|------------------|
| R1 CLOB | `@Lob xmlData` + search `findAll(spec, page)` entity graph | MessageInquiryService + IncomingMessageMasterEntity hunk | packer aynı chunk’ta mapping snippet yok |
| R3 always-join | Specs 31–34 LEFT JOIN messages+tx koşulsuz | MessageInquirySpecs hunk | checklist yok; model Path.get N+1 yazdı |
| R4 size-capped DOM | prettyPrint + toDownloadDto unbounded | XmlContentResolver hunk | model XXE’ye kaydı; gate miss eklemez |
| R8 first-child | `get(0)` BIC/E2E | MessageInquiryService hunk | checklist yok |
| Authz | controller’da `@PreAuthorize` yok; ev stili | MessageInquiryController hunk | checklist var, model yazmadı |

**OVERREACH:** E1,E2,E4,E5,E7–E9,E11–E15,E17–E23 — prompt/gate deliği §7.

Md’de olup snapshot’ta olmayan: çoğu Minor + E7–E10 (cap / seen / findAnchor). Snapshot’ta olup md’de olmayan yeni iddia yok; duplicate CTPS genel comment.

---

## Appendix B — v1 posted inventory (tarihsel, skor değil)

Eski snapshot S1–S13 (Criteria NPE, factory share, DTO byte[], unit-test Critical) v1 gate’in **hedefiydi**. v2 replay’de S6/S10/S12 sınıfı **posted değil** — v1 kısmen işe yaradı. S1 TOCTOU sınıfı Suggested deliği yüzünden **hâlâ Critical**.

---

## Appendix C — Intentionally out of spec

- Qwen/Copilot model ID veya provider değiştirmek
- cosmos-sepa PR #3170 fix (MISS yalnız prompt/pack hedefi)
- Suggested-code derleme
- Gate’in CLOB/authz/join **uydurması**
- Eski Code Review Assistant comment’leri
- graphify’ı extension’a gömmek
- `MAX_INLINE_COMMENTS` yükseltmek tek başına
- UI redesign / VSIX bu oturumda
- Skills gövdesini yeniden yazmak

---

## Approval gate

Spec v2 implemented at:

`docs/superpowers/specs/2026-09-20-pr-reviewer-quality-llm-efficiency-design.md`

Git commit yalnız kullanıcı isterse. VSIX paketleme yok. #3170 replay saha ölçümü (metric §5) ayrı koşu.
