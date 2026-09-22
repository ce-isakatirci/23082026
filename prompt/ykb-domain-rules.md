━━━━━━━━━ YKB DOMAIN KONTROLLERI ━━━━━━━━━

[SEVERITY GATE] — ÇIKTI FORMATI map’ine uyar
- BREAKING CHANGE (A–D), PII/kart log, kanıtlı data loss, bozuk işlev → **Critical**
- Eksik validasyon, Feign/RestTemplate timeout/5xx, pagination/Lob/XXE/authz checklist → **Important**
- NAMING, REST path, net dead code → **Minor**
- gereksiz else / early-return / formatting → yazma

[BREAKING CHANGE — Critical]
A) Response tipi / DTO sınıfı değişti
B) DTO alanı silindi / yeniden adlandırıldı / yeni `@NotNull` zorunlu alan
C) Endpoint path veya HTTP metodu değişti
D) Request body’ye zorunlu alan eklendi

[ANTI-HALLUCINATION — yazma]
- JPA Criteria `root.get(...).get(...)` = Path ifadesi; runtime NPE değil.
- `DocumentBuilderFactory.newInstance()` her çağrıda = doğru thread-safety; static share önerme.
- `@PathVariable` + `@NotNull` = dead/noise; Critical yazma.
- String vs `byte[]` Base64 DTO tipi tek başına Critical değil; `@Lob` / unbounded load / size gate bak.
- Okumadığın / Diff’te olmayan satıra bulgu yok.

[INQUIRY / REST checklist — Important]
- `pageSize` / `pageNumber` üst sınır yoksa Important.
- `@Lob` / büyük payload tam heap + Base64 response → Important (DTO tipi değil yük yolu).
- XML parse: disallow-doctype + external-general/parameter entities + load-external-dtd kapalı değilse Important.
- Yeni `@RestController` endpoint’te method-security / bilinen gateway kanıtı yoksa Important (“kanıt yok” de; exploit uydurma).
- Liste/search: `@Lob` / `xmlData` / EAGER child graph aynı entity’de varsa Important (DTO tipi değil yük).
- Specification: filtre yokken de JOIN + `distinct(true)` → cartesian / pagination skew Important.
- Row mapping `list.get(0)` / first-child BIC/E2E/ref → bulk’ta yanlış kolon Important.
- `Calendar.getInstance()` metod-lokal = thread-safety bulgusu yazma.

[GÜVENLİK]
- PII/kart (tckn, pan, cvv) log → **Critical**
- stacktrace response sızıntısı → **Critical**

[MINOR — yalnızca Diff’te net]
- Türkçe identifier → İngilizce; REST path çoğul/kebab
- Lombok varken boilerplate; kullanılmayan import
- Race/TOCTOU unique constraint kanıtı yoksa → Important (Critical değil)
