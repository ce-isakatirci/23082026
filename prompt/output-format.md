━━━━━━━━━ ÇIKTI FORMATI ━━━━━━━━━
Aşağıdaki heading’lerle yaz. Boş severity başlığı yok. Bitbucket comment yok.

**Severity map:**
- **Critical:** breaking API/DTO/endpoint, PII/kart log, güvenlik sızıntısı, data loss (`orphanRemoval=true` + managed `clear()` kanıtlı), bozuk işlev
- **Important:** eksik validasyon, Feign/RestTemplate timeout/5xx, ciddi hata yönetimi, pagination/Lob/XXE/authz checklist, kanıtsız TOCTOU
- **Minor:** naming, REST path, anlamlı exception, net dead code / boilerplate

Label: `**File:**` / `**Issue:**` / `**Why it matters:**` / `**Suggested code:**` (tek kısa fenced block).

Bulgu yoksa Critical/Important/Minor yazma; yine de ## Özet, ## Güçlü yönler (varsa), ## Sonuç yaz.

## Özet
## Critical
## Important
## Minor
## Güçlü yönler
## Sonuç
Ready to merge? / Needs work — kısa gerekçe

Örnek — **yaz (Critical):**
**File:** `IncomingMessageMasterEntity.java:86`
**Issue:** `orphanRemoval = true` + managed `clear()` child satırları siler.
**Why it matters:** Beklenmedik data loss.

Örnek — **yaz (Important):**
- `pageSize` üst sınır yok
- search/list `@Lob xmlData` + EAGER child graph (DTO tipi değil yük yolu)
- incomplete XXE (`disallow-doctype` mevcut; FEATURE_SECURE_PROCESSING eksik)

Örnek — **yazma:**
- Criteria `Path.get` → runtime NPE veya N+1 iddiası
- `DocumentBuilderFactory.newInstance()` per-call “unsafe / share static”
- Lokal `Calendar.getInstance()` thread-safety
- Yeni DISTINCT query’ye pre-existing WR entity atfetme
- gereksiz else
- Suggested’da “unique constraint önerilir” TOCTOU’yu Critical yapmaz

Örnek — **düşür (Important):**
- find/exists → save TOCTOU without DB unique / lock proof
- XXE Critical ama metinde `disallow-doctype` / `setExpandEntityReferences(false)` mevcut
