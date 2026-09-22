# YKB PR Reviewer Extended

VS Code eklentisi: **Bitbucket Server** üzerindeki Pull Request’leri Superpowers skill rubric’i ile inceler. Model olarak **GitHub Copilot** veya OpenAI-uyumlu **IDE assistant** (`ai-ide-assistant.providers`, örn. Qwen) kullanılır.

Sonuç workspace root’ta `review-*.md` olarak yazılır. **PR’a Comment At** ve otomatik review, bulguları Bitbucket’ta **satır (inline) comment** olarak ilgili diff satırına gönderir; ayrıca **genel (anchor’sız) PR comment** atar — bu genel comment’te yalnızca merge’ü bloklayan **Critical** maddeler vardır (yoksa kısa bir “bloklayan bulgu yok” açıklaması).

Sürüm: **1.7.20** · Publisher: `ykb` · VS Code `^1.90.0`

### 1.7.20

- **Dev Bulk Review:** clone/checkout sonrası `git fetch origin` + `git diff origin/dev...feature -- src/main/java`. Her değişen dosya `{feature}-{pathSlug}-{datetime}.diff` olarak yazılır; model Qwen context bütçesine göre hybrid chunk’larda (diff + CodeGraph related) review eder. Bitbucket satır + genel comment aynı (`postInlineForPr`). Review Et, Comment At, Auto Review ve Code Review değişmedi.

### 1.7.19

- **Docs (junior):** 5 dakikada başla + hangi paneli kullanayım tablosu; PR Agent kurulum netleştirildi.
- **settings.example.json:** `crgReview.*` ve `prAgentReview.*` eklendi; `ai-ide-assistant.providers` (Qwen) örneği korunur. Sync script bu anahtarları silmez.

### 1.7.18

- **PR Agent paneli:** Dev Bulk / OCR ile aynı UX. [The-PR-Agent/pr-agent](https://github.com/The-PR-Agent/pr-agent): repo cache’te git sync → `git diff origin/dev...feature` → `pr-agent --diff-file … --json-output … review` → local `review-*.md` + Bitbucket satır/genel comment (`ykb-pr-reviewer-extended-pra` marker). Sayaç `praReviewPrKeys`. LLM = `ai-ide-assistant.providers` (enabled Qwen/Bifrost). Dev Bulk / Code Review / OCR / CRG / PR Agent aynı anda çalışmaz.
- **Sil (ortak):** PRA marker + sayaç da dahil.

### 1.7.17

- **Post hard-gate:** Bitbucket comment atılmadan önce extension marker’lı eski comment’ler silinmeli; silme fail / kısmi / 0 ise **yeni post yok**.
- **Code Review paneli:** Artık `runCodeReview` (4 uzman: CLAUDE.md / bug / blame / comment + confidence). Clone yoksa cache’e clone, varsa fetch + `toHash` checkout. Local md yok. Post silmede Dev Bulk marker’ları da (`EXTENSION_COMMENT_MARKERS`).
- **Sil (ortak):** Herhangi bir bulk paneldeki Sil → tüm panel sayaçları sıfır + tüm extension marker’ları (Bulk / Code Review / OCR / CRG).
- **Docs:** Code Review ≠ Alibaba OCR (OCR ayrı panel). Auto Review marker görünce skip (üzerine sil-yeniden-post yok).

### 1.7.16

- **Ortak PR kartı tüm panellerde:** Review Et, Comment, Preview, Onayla, Onayı Kaldır butonları Dev Bulk / Code Review / OCR / CRG dahil her kartta; status + `Onay x/y` sayacı + review rozeti.
- Bulk paneller `getCurrentUser` ile doğru onay status’u gösterir; approve/unapprove sonrası PR listesi yenilenir.
- Sidebar view’lar varsayılan **collapsed** (kapalı) gelir.
- **Docs düzeltme — paneller:** **Code Review ≠ OCR.** OCR = Alibaba `ocr` CLI (ayrı panel). Code Review paneli şu an Dev Bulk ile aynı `runReview` (local broad / CodeGraph) yolunu kullanır; `codeReviewRunner` (4 uzman + confidence) **bağlı değil** — `codeReview.minConfidence` / `criticalMin` panelde etkisiz.

### 1.7.15

- **CRG Review paneli:** Dev Bulk / OCR ile aynı UX. [tirth8205/code-review-graph](https://github.com/tirth8205/code-review-graph): repo cache’te git sync + checkout → `build`/`update` + `detect-changes --base origin/dev` → Copilot/IDE LLM → local `review-*.md` + Bitbucket satır/genel comment (`ykb-pr-reviewer-extended-crg` marker). Sayaç `crgReviewPrKeys`. Dev Bulk / Code Review / OCR / CRG aynı anda çalışmaz.

### 1.7.14

- **OCR Review paneli:** Dev Bulk ile aynı UX (repo seç, OPEN → `dev` PR, çalıştır / durdur). Alibaba [Open Code Review](https://github.com/alibaba/open-code-review) CLI: repo cache’te `git fetch` → `ocr review --from origin/dev --to origin/&lt;feature&gt; --format json` → local `review-*.md` + Bitbucket satır/genel comment (`ykb-pr-reviewer-extended-ocr` marker). Sayaç `ocrReviewPrKeys`. Dev Bulk / Code Review / OCR aynı anda çalışmaz.

### 1.7.13

- **Code Review eşiği:** `codeReview.minConfidence` (varsayılan 80) altındaki bulgu elenir. `codeReview.criticalMin` (varsayılan 90) ve üzeri Critical, aralık Important.

### 1.7.12

- **Ortak PR kartı:** PR'larım, Bana Açılan, Repo, Dev Bulk ve Code Review aynı satır tasarımını kullanır (başlık, meta, sağ alt rozet, progress). Liste panellerinde aksiyon butonları kartın altında durur.
- **Veri ayrı:** her panelin repo seçimi, PR seçimi ve review sayacı kendine aittir. Bir panelin silmesi veya review'u diğer panelin sayacını değiştirmez.

### 1.7.11

- **Code Review ve Dev Bulk ayrıdır:** repo seçimi, PR listesi ve sayaç birbirine kopyalanmaz. Panel açılınca kendi repo listesini yükler ve **Repolar** panelini açar.

### 1.7.10

- **Code Review — PR'ları yükle:** panel kendi repo listesini hiç kaydetmediyse Dev Bulk seçimini bir kez alır. Kullanıcı Code Review kutularını temizlerse tekrar kopyalanmaz.
- Yükleme bitince **PR listesi** paneli açılır ve başlıkta sayı görünür. İstek hata verirse durum satırı "PR yok" yerine düşen repo adını yazar.
- Canlı status güncellemesi Code Review çalıştır butonunu Dev Bulk metnine çevirmez.

### 1.7.9

- **Code Review paneli:** Dev Bulk ile aynı UX (repo seç, OPEN → `dev` PR, çalıştır / durdur). Dört uzman model çağrısı (CLAUDE.md, bug, git blame, code comment) ve confidence ≥ 80. Skor ≥ 90 Critical, 80–89 Important.
- Post öncesi **Dev Bulk dahil** extension marker’lı eski comment’ler silinir; yeni satır comment + genel Critical comment `ykb-pr-reviewer-extended-code-review` marker’ı ile atılır. Local md yazılmaz.
- Sayaç `codeReviewPrKeys`. İki panel aynı anda çalışmaz.

### 1.7.8

- **findingGate v2 (PR #3170 saha):** Suggested “unique constraint önerilir” TOCTOU’yu Critical tutmaz; XXE `disallow-doctype` mevcutsa Important; lokal Calendar / Criteria N+1 / WR-hunk / nitpick drop; path:line dedupe.
- **Pack:** `MessageInquiryService` ile master entity (`@Lob` / `orphanRemoval`) aynı chunk; related entity snippet max 80 satır.
- **Post:** inline cap 20 severity sırası Critical → Important → Minor.
- **Token:** `prompt.compactFindingsOnly` (default true) — multi-chunk i>0 kısa kural seti. Rollback: `findingGate.enabled=false` veya `compactFindingsOnly=false`.
- **Bitbucket REST probe kaldırıldı:** extension load’da dummy target’larla tüm REST endpoint’ler yoklanmaz.

### 1.7.7

- **filesRoot taşınma:** klasör `ykb\ykb-pr-reviewer-extended` → `ykb-pr-reviewer-extended` taşındıktan sonra settings `filesRoot` yeni yola güncellenir.
- Kaynak ağaç 1.7.4’te kalan **Bitbucket REST probe** (1.7.6) yeniden sync edildi.

### 1.7.6

- **Bitbucket REST probe:** extension load’da kayıtlı token varsa dummy target’larla REST endpoint’ler sırayla yoklanır (gerçek PR’a yazılmaz). 5xx / bağlantı yoksa Output + warning.

### 1.7.5

- package bump (changelog 1.7.6’da birleştirildi).

### 1.7.4

- **Unit test skip:** `test` / `tests` / `__tests__` dizinleri ve `*Test.java|kt`, `*.test|spec.js|ts`, `*_test.js|ts` review pack + related context dışı.
- `deniedPathSegments` default’una unit test dizinleri eklendi.

### 1.6.9

- **Prompt/skill hizası:** Dil/label kanonik (`**File:**` / `**Issue:**` / `**Why it matters:**` / `**Suggested code:**`); skill template Diff-first + TR merge headings; severity gate (YKB domain).
- `skills-intro` bozuk meta satırı kaldırıldı; findings-only / chunk reminder drift azaltıldı.
- README best-practice checklist eklendi.

### 1.6.8

- **Related co-location:** CodeGraph related dosyaları, tetikleyen changed ile aynı chunk’ta pack edilir (orphan trailing related yok).
- **Cross-chunk bridge:** multi-chunk review’da sonraki chunk’lara önceki path listesi + findings özeti + unresolved symbols taşınır.
- Expansion `relatedTo` metadata’sı packer co-location için kullanılır.

### 1.6.7

- (ara sürüm) package bump; changelog notu 1.6.8’de birleştirildi.

### 1.6.6

- **currentUserSlug:** `/users/~` önce; `slug || name`. API boşsa tek bot author veya dashboard reviewer infer.
- Slug yokken önceki bot comment silinip yeniden post edilebilir (tek author); çoklu author’da duplicate önlemi aynı.

### 1.6.5

- **Dev Bulk Durdur:** kırmızı **Durdur** butonu — hard kill (model HTTP/Copilot cancel, git/codegraph child kill); kalan PR’lar atlanır.

### 1.6.4

- **Windows CodeGraph ENOENT fix:** `codegraph.cmd` PATH’ten çözülür; `execFile` için `shell: true` (yalnızca `.cmd` / `codegraph`).

### 1.6.3

- **CodeGraph zorunlu:** clone / checkout / `codegraph init|sync` fail olursa review **iptal** + alert; diff-only fallback yok.
- Symbol yok veya related boşsa review devam eder (altyapı çalışmış sayılır).
- Dev Bulk / Auto Review: PR başına `showErrorMessage`; sıradaki PR’a devam.

### 1.6.2

- **Dev Bulk Review:** checked PR’da kendi bot comment’i (satır + genel, nested reply dahil) varsa silinir; yeni review Bitbucket’a post edilir; review sayacı +1.
- Marker’lı önceki comment artık bulk’ta skip edilmez. **Tümünü seç** veya checkbox ile tekrar review.
- `currentUserSlug` yokken silme yapılamaz: marker’lı comment varsa yeni post yok (duplicate önlemi).
- **PR'a Comment At** aynı sil-yeniden-post yolunu kullanır. **Otomatik review** skip aynı kalır.

### 1.6.1

- **Dev Bulk Review:** repo ve PR checkbox listeleri iki ayrı collapse panel (varsayılan kapalı); open state webview state’te saklanır.
- Review sayısı rozeti bulk panelde sağ alta taşındı (ana PR listesi üst sağda kalır).

### 1.6.0

- **Context expansion:** PR review öncesi repo `%USERPROFILE%/repo_review/<project>/<repo>/` altına clone edilir, PR `toHash` checkout yapılır, `codegraph init/sync` çalışır.
- Diff’ten çıkarılan symbol/key’ler için repo-içi **Related context** dosyaları chunk’a eklenir (`#### File (related context, read-only)`).
- `node_modules`, `target`, `dist`, `out`, `.git` denylist — index ve chunk dışı.
- Repo içinde consumer bulunamayan symbol’ler (ör. `holdModal` → `cosmos-common-ui`) için **spekülatif i18n completeness** bulgusu suppress edilir (`Unresolved symbols` bloğu + prompt kuralı).
- Git/codegraph hata verirse review diff-only fallback ile devam eder (1.6.3’te hard-fail).

**Gereksinimler:** `git` ve `codegraph` CLI PATH’te olmalı; Bitbucket token clone için kullanılır.

### 1.5.11

- README, 1.5.9–1.5.10 davranışlarıyla hizalandı (satır comment sanitize, Output Channel’da modele giden dosya içeriği).
- Satır comment / otomatik review prompt’u her bulguda kısa **Suggested code** fenced block ister.

### 1.5.10

- Output Channel (`YKB PR Review Extended`) chunk loguna path yanında **modele giden dosya içeriği** ve `userText` yazar.
- SEND payload string tavanı 100000 karakter; uzun prompt kesilmez (secret alanlar yine `***`).

### 1.5.9

- Bitbucket satır comment: finding başlığında bold + backtick birlikte olunca Bitbucket yalnız backtick gösteriyordu.
- `sanitizeBitbucketInlineMarkdown` backtick içeren `**...**` sarmalayıcılarını kaldırır.

### 1.5.8

- **PR'a Comment At** ve otomatik review, satır comment’lerin yanında **genel (anchor’sız) PR comment** atar.
- Genel comment’te yalnızca merge’ü bloklayan **Critical** maddeler yer alır.
- Critical yoksa (başlık yok, boş veya “sorun yok”) kısa açıklama yazılır: bloklayan bulgu olmadığı belirtilir.
- **Review Et** hâlâ Bitbucket’a comment yazmaz. Eski comment’ler silinmez.

## Ne işe yarar?

- Sol Activity Bar’da **YKB PR Review** paneli: kendi PR’ların, reviewer atandığın PR’lar, seçilen repo’nun açık PR’ları
- **Review Et:** local `review-*.md` üretir (Bitbucket’a comment yok)
- **PR’a Comment At:** aynı review’i üretir, local md yazar; kendi önceki bot comment’lerini siler; `path:line` satır comment + genel comment (yalnızca Critical / yoksa açıklama)
- **Dev Bulk Review:** seçili repo’ların OPEN → `dev` PR’ları; repo cache clone/checkout sonrası `git fetch origin` + `git diff origin/dev...feature -- src/main/java`; her değişen dosya için workspace’e `{feature}-{pathSlug}-{datetime}.diff`; Qwen context bütçesine göre hybrid chunk (1–N dosya + CodeGraph related) + findings bridge merge; checked satırlar için sil + yeniden post + sayaç +1 (local md yok; Bitbucket satır + genel comment aynı)
- **Code Review:** aynı liste UX’i; **Alibaba OCR değil.** 4 uzman (`CLAUDE.md` / bug / blame / comment) + `codeReview.minConfidence` / `criticalMin`; clone/checkout(`toHash`) + Bitbucket post (`…-code-review`); local md yok. Post öncesi Dev Bulk dahil extension marker’ları silinir
- **OCR Review:** aynı liste UX’i; **Alibaba** `ocr` CLI (`--from origin/dev --to origin/&lt;branch&gt;`); local md **ve** Bitbucket satır + genel comment (`ykb-pr-reviewer-extended-ocr`)
- **CRG Review:** aynı liste UX’i; `code-review-graph` detect-changes context + Copilot/IDE LLM; local md **ve** Bitbucket satır + genel comment (`ykb-pr-reviewer-extended-crg`)
- **PR Agent:** aynı liste UX’i; [The-PR-Agent/pr-agent](https://github.com/The-PR-Agent/pr-agent) plain-diff CLI (`--diff-file` + `--json-output review`); local md **ve** Bitbucket satır + genel comment (`ykb-pr-reviewer-extended-pra`)
- **PR Preview:** diff’i Markdown Preview’da açar (model çağırmaz)
- **Approve / Unapprove:** Bitbucket onayını VS Code’dan değiştirir
- **Otomatik review:** inbox’taki açık PR’lara periyodik satır + genel comment (local md yok). Marker’lı comment varsa **skip** (silip üzerine yazmaz)
- **Sil (bulk paneller):** ortak — tüm panel sayaçları + tüm extension comment marker’ları
- Prompt; Superpowers skill’leri, YKB domain kuralları ve workspace override ile özelleştirilir

## Base `ykb-pr-reviewer` ile farklar

| Özellik | Base | Extended |
|---|---|---|
| Review rubric | Sabit prompt | Superpowers skill pack (`requesting-code-review` + `code-reviewer.md`) |
| Çıktı | Bitbucket comment veya Output | Workspace `review-*.md`; satır comment + genel Critical comment |
| Preview | Yok | Markdown Preview (ayarlanabilir) |
| Config prefix | `ykbPrReviewer.*` | `ykbPrReviewerExtended.*` |
| Model | Copilot | Copilot **veya** `ai-ide-assistant.providers` (Qwen vb.) |

---

## Gereksinimler

- VS Code **1.90.0** veya üzeri
- Açık bir **workspace folder** (review md buraya yazılır)
- Bitbucket **Personal Access Token** (PR okuma + comment yazma)
- Copilot yolu için [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) (oturum açık)
- Qwen / IDE assistant yolu için `ai-ide-assistant.providers` listesinde `enabled: true` bir kayıt (`baseUrl`, `model`, `apiKey`)
- Context expansion / clone yolu için: `git` ve `codegraph` CLI PATH’te
- **OCR Review** paneli için: Alibaba Open Code Review CLI (`ocr`) PATH’te veya `ocrReview.executablePath`; `ocr config set` + `ocr llm test` başarılı olmalı
- **CRG Review** paneli için: [code-review-graph](https://github.com/tirth8205/code-review-graph) CLI PATH’te veya `crgReview.executablePath` (`pip install code-review-graph`, Python 3.10+)
- **PR Agent** paneli için: [pr-agent](https://github.com/The-PR-Agent/pr-agent) CLI `%USERPROFILE%\python\Scripts` (veya `prAgentReview.executablePath`); LLM = `ai-ide-assistant.providers` (enabled Qwen/Bifrost)

Panel Copilot olmadan da açılır. Copilot Chat yalnızca Copilot model çağrısı ve Ayarlar’daki model listesi için gerekir.

### OCR Review kurulum

1. `npm install -g @alibaba-group/open-code-review` (veya release binary’yi PATH’e ekle)
2. `ocr config set` ile OpenAI-uyumlu endpoint / model / API key
3. `ocr llm test` — bağlantı OK olmalı
4. Sidebar **OCR Review**: repo seç → PR’ları yükle (dev) → checked satırlarda çalıştır

Komut özeti (extension’ın her PR için yaptığı): `ocr review --from origin/dev --to origin/&lt;feature-branch&gt; --format json --audience agent`

### CRG Review kurulum

1. `pip install code-review-graph` (Python 3.10+)
2. PATH’te `code-review-graph` görünsün (veya `crgReview.executablePath`)
3. Sidebar **CRG Review**: repo seç → PR’ları yükle (dev) → checked satırlarda çalıştır
4. İsteğe bağlı (Cursor agent MCP): `code-review-graph install --platform cursor` — panel için zorunlu değil

Komut özeti (extension’ın her PR için yaptığı): git checkout feature → `code-review-graph build|update` → `detect-changes --base origin/dev --brief` → Copilot/IDE LLM

### PR Agent kurulum

Junior checklist:

1. Python zaten `%USERPROFILE%\python` altındaysa:  
   `& "$env:USERPROFILE\python\python.exe" -m pip install pr-agent`
2. Cursor/VS Code `settings.json` içinde `ai-ide-assistant.providers` → bir kayıt `enabled: true` (ör. Qwen + Bifrost `baseUrl` / `model` / `apiKey`).
3. (Opsiyonel) `node scripts/setup-pr-agent-from-ide.js` — settings’ten `%USERPROFILE%\.pr_agent\` yazar.
4. Sidebar **PR Agent** → repo seç → **PR'ları yükle** → çalıştır.

CLI yolu boşsa extension otomatik `%USERPROFILE%\python\Scripts\pr-agent.exe` arar; override: `prAgentReview.executablePath`.

Komut özeti (extension’ın her PR için yaptığı): git fetch → `git diff origin/dev...feature` → `pr-agent --diff-file … --json-output … --extra_config_url … review`

### Best-practice checklist (reviewer extension)

Prompt / rubric:

- [ ] Tek output schema — `mergeChunkReviews` ile birebir (`## Critical|Important|Minor|Güçlü yönler|Özet|Sonuç`)
- [ ] Tek dil politikası — bulgu başlığı TR; sabit label `**File:**` vb. EN; terminology EN
- [ ] Diff-first scope — File/related = read-only doğrulama; unresolved için spekülasyon yok
- [ ] Severity taxonomy — breaking API/PII → Critical; reliability/validation → Important; naming → Minor
- [ ] Nitpick denylist — else/early-return/formatting davranış yoksa yazma
- [ ] Chunk-safe prompts — multi-chunk findings-only; merge Özet/Sonuç sentezler
- [ ] Workspace override — `prompt/*.md` workspace’te override edilebilir
- [ ] Skill/template drift yok — bundled skill, prompt MD ve parser aynı gerçek

Pipeline / altyapı:

- [ ] CodeGraph zorunlu — fail → review iptal (diff-only fallback yok)
- [ ] Context expansion — related co-location, denylist path, unresolved list
- [ ] Cross-chunk bridge — önceki path + findings özeti
- [ ] Bütçe — maxDiff/maxPrompt/maxFile; skippedPaths Özet/Sonuç’ta
- [ ] Abort — bulk/model hard kill

Bitbucket / UX:

- [ ] **Review Et** comment post etmez; **PR'a Comment At** / auto = inline + genel Critical-only
- [ ] Bitbucket markdown sanitize (bold+backtick)
- [ ] Idempotent post — bot comment sil-yeniden-post; slug yoksa duplicate koruması
- [ ] Artifact — `review-*.md` + Output Channel prompt log (secret mask)

Güvenlik / ops:

- [ ] Token/baseUrl settings; log’da secret mask
- [ ] Temperature düşük default (0.2)
- [ ] `extraInstructions` proje özel; domain rules’tan ayrı
- [ ] Prompt path/flag `defaults.json` ↔ `settings.example.json` sync

Kalite kapısı:

- [ ] Prompt fixture testleri (`test/promptConfig.test.js`, `test/reviewPack.test.js`)
- [ ] findingGate saha fixture (`test/findingGate.test.js`) + inquiry entity bridge
- [ ] Golden sample: single-chunk + multi-chunk beklenen markdown
- [ ] Breaking-change domain örnek diff regression

## 5 dakikada başla (junior)

1. **VSIX kur:** `node scripts/package-vsix.js` → Extensions → Install from VSIX.
2. **Ayar kopyala:** [`settings.example.json`](settings.example.json) içinden User/Workspace `settings.json`’a yapıştır.
3. **Doldur:** Bitbucket `token` + `ai-ide-assistant.providers[].apiKey` (boş bırakma).
4. **Token kaydet:** Command Palette → `YKB PR Reviewer Extended: Bitbucket Token Kaydet` (veya settings’teki token yeter).
5. **Panel aç:** Activity Bar → **YKB PR Review** → istediğin paneli aç (varsayılan kapalı/collapsed).
6. **Akış (bulk paneller):** repo checkbox seç → **PR'ları yükle (dev)** → satırları işaretle → **çalıştır**.

İlk deneme için en basit yol: **Dev Bulk Review** (Copilot veya Qwen; ek CLI yok).

### Hangi paneli kullanayım?

| Panel | Ne yapar (kısa) | Ek kurulum | Local md | Bitbucket comment |
|---|---|---|---|---|
| **Dev Bulk** | Extension kendi review’i (CodeGraph) + `git diff origin/dev...feature` | `git` + `codegraph` | Hayır (`.diff` dosyası evet) | Evet |
| **Code Review** | 4 uzman + confidence | `git` + `codegraph` | Hayır | Evet |
| **OCR Review** | Alibaba `ocr` CLI | `ocr` + kendi LLM config | Evet | Evet |
| **CRG Review** | code-review-graph + Copilot/Qwen | `pip install code-review-graph` | Evet | Evet |
| **PR Agent** | The-PR-Agent `pr-agent` CLI | `pip install pr-agent` (USERPROFILE python) | Evet | Evet |

Notlar:

- Aynı anda **tek** bulk panel çalışır (Dev Bulk / Code Review / OCR / CRG / PR Agent).
- **OCR** ve **PR Agent** kendi LLM’lerini kullanır; PR Agent LLM’i `ai-ide-assistant.providers` (Qwen/Bifrost).
- **Code Review ≠ OCR.** OCR = Alibaba CLI; Code Review = extension 4 uzman.

---

## Kurulum

1. VSIX üret (proje kökünde):

   ```powershell
   node scripts/package-vsix.js
   ```

   Çıktı: `ykb-pr-reviewer-extended-<sürüm>.vsix`

2. VS Code / Cursor: **Extensions** → `...` → **Install from VSIX…** → üretilen dosyayı seç.

3. İlk aktivasyonda sol panel açılır. Görünmezse `Ctrl+Shift+P` → **YKB PR Reviewer Extended: Sol Paneli Ac**.

Örnek ayarlar: [`settings.example.json`](settings.example.json). Anahtarları User veya Workspace `settings.json` içine kopyala; `apiKey` / `token` alanlarını kendin doldur (commit etme).

---

## İlk kurulum

### 1. Bitbucket token

Token sırası:

1. `ykbPrReviewerExtended.token` (settings) doluysa o kullanılır
2. Değilse VS Code **Secret Storage** (`ykb-pr-reviewer-extended-token`)
3. İkisi de boşsa işlem sırasında Input Box sorulur ve secret store’a yazılır

Kaydetmek için:

- Paneldeki **Token kaydet** bağlantısı, veya
- `Ctrl+Shift+P` → **YKB PR Reviewer Extended: Bitbucket Token Kaydet**

Temizlemek: **Bitbucket Token'i Temizle** (yalnızca secret store). Settings’teki `token` alanını ayrıca silmeniz gerekir.

401 gelirse secret store’daki token silinir; komutu yeniden çalıştırın.

### 2. Base URL

Varsayılan:

```json
"ykbPrReviewerExtended.baseUrl": "https://sdlc.yapikredi.com.tr/bitbucket"
```

### 3. Model seçimi

İki yol vardır; ikisi birden aynı anda kullanılmaz.

| `ykbPrReviewerExtended.aiIdeAssistant.use` | Davranış |
|---|---|
| `false` (package.json varsayılan) | GitHub Copilot. Model: `ykbPrReviewerExtended.model` (varsayılan `gpt-5.4-mini`). Sidebar **Ayarlar** → Copilot model `<select>` |
| `true` | `ai-ide-assistant.providers` içinden `enabled: true` olan kayıt. Tercih: Qwen3 (id/name’de `resim` geçenler elenir). API Key boş veya `enabled` yoksa provider kullanılmaz |

IDE assistant (`aiIdeAssistant.use: true`) yanıt vermezse eklenti **Copilot’a düşmez** — hata gösterilir. Copilot yalnızca `use: false` iken kullanılır.

`settings.example.json` içinde `aiIdeAssistant.use` **true** ve örnek Qwen provider’ları vardır. `apiKey` değerini kendiniz doldurun.

Copilot model id’sini panoya almak: **Kullanilabilir Modelleri Listele**.

---

## Sol panel (Activity Bar)

Kurulumdan sonra **YKB PR Review** ikonu görünür.

| View | İçerik | Kullanım |
|---|---|---|
| **Ayarlar** | Copilot model + **Ek talimatlar** | Model değişince `settings.json`’a yazılır. Ek talimatlar textarea’dan **blur** ile kaydedilir |
| **PR'larim** | Yazar olduğun açık PR’lar (`role=AUTHOR`) | Satıra tıkla → seç |
| **Bana Acilan PR'lar** | Reviewer atandığın açık PR’lar | Satıra tıkla → seç |
| **Dev Bulk Review** | Seçili repo’ların OPEN → `dev` PR’ları | Repo checkbox → PR’ları yükle → checked satırları review et |
| **Code Review** | Aynı OPEN → `dev`; 4 uzman + confidence (OCR değil) | Repo → PR yükle → code review (local md yok) |
| **OCR Review** | Aynı OPEN → `dev` listesi; Alibaba `ocr` CLI | Repo → PR yükle → OCR (local md + comment) |
| **CRG Review** | Aynı OPEN → `dev` listesi; code-review-graph + Copilot/IDE | Repo → PR yükle → CRG (local md + comment) |
| **PR Agent** | Aynı OPEN → `dev` listesi; The-PR-Agent `pr-agent` CLI | Repo → PR yükle → PR Agent (local md + comment) |
| **Repo PR'lari** | Seçilen repo’nun açık PR’ları | Search / Repo seç; workspace `origin` Bitbucket `scm/PROJ/repo` ise otomatik seçilir |

### PR seçimi ve aksiyonlar

Listeden bir PR’a tıklayınca satır highlight olur. Üst toolbar (seçim varken):

| Aksiyon | Ne yapar |
|---|---|
| **Review Et** | Model çağrısı → workspace’e `review-*.md` |
| **PR'a Comment At** | Review + local md + kendi bot comment sil + satır + genel Critical comment |
| **PR Preview** | Diff markdown; model yok |
| **PR Approve** | Bitbucket approve |
| **PR Unapprove** | Bitbucket unapprove |
| **Secimi Iptal** | Highlight kalkar |
| **Yenile** | Listeyi yeniden çeker |

Satırdaki ikon butonları aynı aksiyonları tetikler (review / approve / unapprove).

Review edilmiş PR’lar (globalState) listede **reviewed** stiliyle işaretlenir. Review sırasında satırda yüzde/progress metni görünür.

### Repo PR’ları: search ve seçim

- **PR / Repo Ara:** PR başlığı, yazar, `#id`, veya `PROJ/repo`. Repo seçiliyken metin listedeki PR’ları filtreler. `PAY/payment-service` yazılırsa o repo seçilir.
- **Repo Sec:** Ad ile ara. **Boş bırakılırsa** erişilebilir **tüm** repo sayfaları çekilir (ilk 25 ile sınırlı değil). `PROJ/repo` kısayolu desteklenir.

Otomatik repo: workspace `.git/config` `origin` URL’si Bitbucket `scm/PROJ/repo` ise **Repo PR'lari** o repoyu seçer.

---

## Review nasıl çalışır?

1. Bitbucket’tan PR detay + **EFFECTIVE** diff alınır.
2. `contextExpansion.enabled` ise repo cache clone + `toHash` checkout + codegraph index/sync; diff symbol’leri için repo-içi related dosyalar bulunur. Clone/codegraph fail → review **iptal** + alert (diff-only yok).
3. Dosyalar allowlist ile süzülür (aşağıda). Hiçbiri kalmazsa tüm diff fallback olarak paketlenir.
4. **Changed** dosyalar: `#### Diff` + isteğe bağlı `#### File`. **Related** dosyalar: yalnızca read-only `#### File`.
5. Karakter tavanlarına göre **chunk**’lara bölünür. Dosya **atlanmaz**; sığmazsa yeni chunk açılır.
6. Her chunk için system + user prompt modele gider.
7. Birden fazla chunk varsa cevaplar **Critical / Important / Minor** başlıklarında birleştirilir (`findings-only` format).
8. `writeFile` true ise workspace’e md yazılır; `openPreview` true ise Markdown Preview açılır.

### Review modları

| Kaynak | Local md | Satır comment | Genel PR comment |
|---|---|---|---|
| **Review Et** / URL / Inbox QuickPick | Evet | Hayır | Hayır |
| **PR'a Comment At** | Evet | Evet (max **20** satır); kendi önceki bot comment silinir | Evet — yalnız Critical; yoksa açıklama |
| **Dev Bulk Review** | Hayır | Evet (max **20**); kendi önceki bot comment silinir | Evet — yalnız Critical; yoksa açıklama |
| **Code Review** | Hayır | Evet (max **20**); `…-code-review`; post öncesi Bulk+CodeReview marker silinir (fail → post yok) | Evet — yalnız Critical; yoksa açıklama |
| **OCR Review** | Evet | Evet (max **20**); `…-ocr` marker; Alibaba `ocr` CLI | Evet — yalnız Critical; yoksa açıklama |
| **CRG Review** | Evet | Evet (max **20**); `…-crg` marker; code-review-graph + LLM | Evet — yalnız Critical; yoksa açıklama |
| **PR Agent** | Evet | Evet (max **20**); `…-pra` marker; The-PR-Agent plain-diff CLI | Evet — yalnız Critical; yoksa açıklama |
| **Otomatik review** | Hayır | Evet (max **20**) | Evet — yalnız Critical; yoksa açıklama |

### Genel (anchor’sız) PR comment

**PR'a Comment At** ve otomatik review, satır comment’lerin yanında bir genel PR comment de atar:

- Gövde yalnızca `## Critical` maddeleridir (Özet / Important / Minor / Sonuç yok).
- Critical yoksa veya başlık boş / “sorun yok” ise: *Bu PR'da merge'ü bloklayan Critical bulgu yok.*
- Marker aynı (`ykb-pr-reviewer-extended`); otomatik review bu marker görünce PR’ı atlar. Bulk / Comment At atlamaz.

### Inline comment kuralları

- Review metnindeki `src/Foo.java:42` (veya `**File:** \`path:line\``) referansları diff satırına bağlanır.
- Diff’te olmayan path’e comment **yok**.
- Aynı satıra bir kez; tavan **20** comment / PR.
- Marker: `ykb-pr-reviewer-extended` (comment gövdesinde).
- Hash’ler Bitbucket **409 OutOfDate** olmaması için diff response’taki `fromHash` / `toHash` (EFFECTIVE merge) ile gider.
- **PR'a Comment At**, **Dev Bulk Review**, **Code Review:** yalnızca bu kullanıcının marker’lı bot comment’leri (satır + genel, nested reply dahil) silinir; silme tamamlanmazsa **yeni comment atılmaz**. Başkasının comment’i silinmez.
- `currentUserSlug` alınamaz ve marker’lı comment varsa yeni post **yok** (duplicate yığılması önlenir).
- **Otomatik review:** marker’lı comment zaten varsa o PR **atlanır** (tekrar yok, dialog yok).
- Bulk’ta tekrar review için daha önce işlenmiş PR’ı checkbox ile seçin veya **Tümünü seç**.
- Prompt, her bulguda kısa **Suggested code** fenced block ister; fenced block satır comment gövdesinde korunur.
- Comment body Bitbucket markdown için sanitize edilir: backtick içeren `**...**` sarmalayıcıları kaldırılır (aksi halde Bitbucket yalnız backtick gösterir).

### Çıktı dosyası

Örnek ad:

```text
review-#42-payment-service-refactor-2026-09-12T21-15-30.md
```

Aynı saniye çakışırsa `-1.md`, `-2.md` eklenir. Workspace folder yoksa hata: *Önce bir folder açın.*

Cümle akışı Türkçe; teknik terimler (`endpoint`, `DTO`, `diff`, `merge`) İngilizce kalır.

Markdown iskeleti:

```markdown
# PR Review — #42 Fix NPE
- Repo / Author / Branch / Model / Generated / Skills

## Özet
## Critical
## Important
## Minor
## Güçlü yönler
## Sonuç
```

Gerçek bulgu yoksa o başlık atlanır; “sorun yok” yazılmaz.

---

## Hangi dosyalar incelenir?

**Dahil uzantılar:** `.java` `.kt` `.js` `.ts` `.xml` `.sql` `.yml` `.yaml` `.properties`

**Dahil dosya adları:** `pom.xml`, `build.gradle`, `package.json`, `web.xml`, `application*.yml|yaml|properties`

**Hariç dizinler:** `node_modules`, `target`, `dist`, `out`, `.git`, `.idea`, `test`, `tests`, `__tests__`

**Hariç unit test dosyaları:** `*Test.java` / `*Tests.java` / `*Test.kt`, `*.test.js|ts`, `*.spec.js|ts`, `*_test.js|ts` (modele gönderilmez)

**Hariç dosyalar:** `package-lock.json`, `yarn.lock`

**Hariç uzantılar:** `.jar` `.class` `.war` görseller, `.pdf`, font, `.exe` `.dll` `.zip`

### Karakter tavanları (chunk)

Hepsi `0` = sınırsız. Kodda gizli tavan yok.

| Ayar | Varsayılan | Anlamı |
|---|---|---|
| `maxDiffChars` | 8000 | Dosya başına diff metni |
| `maxFileChars` | 2500 | Tam dosya içeriği; aşılırsa `truncated` |
| `maxPromptChars` | 400000 | System + user chrome + dosya paketi toplam tavanı (0 = sınırsız); Qwen3.6 262k ile hizalı |
| `contextExpansion.maxRelatedFiles` | 3 | Related context dosya sayısı tavanı |
| `contextExpansion.maxRelatedFileChars` | 1500 | Related dosya içeriği tavanı |
| `contextExpansion.cacheRoot` | `%USERPROFILE%/repo_review` | Repo clone cache |

Packer, `maxPromptChars` içinden system + chrome düşülmüş kalanı dosya paketine verir. `maxReviewChunks` **yoktur**; dosya atlanmaz.

---

## Prompt ve skill’ler

Default metinler eklenti içindedir: `prompt/*.md`, `skills/**`. JSON’da yalnızca bayrak, path ve kısa heading / temperature tutulur.

Her `prompt.files.*` path için okuma sırası:

1. Workspace root’ta aynı relative path (`prompt/ykb-domain-rules.md`)
2. Workspace root’ta aynı dosya adı (`ykb-domain-rules.md`)
3. Extension bundled dosya

`ykbPrReviewerExtended.prompt.filesRoot` doluysa workspace override **atlanır**; yalnızca o kök okunur.

### Include bayrakları

| Ayar | Varsayılan | Prompt’a eklenen |
|---|---|---|
| `prompt.includeSkills` | true | Distilled Superpowers (`using-superpowers`, `requesting-code-review`, `code-reviewer.md`) |
| `prompt.includeLanguageRule` | true | Türkçe cümle + İngilizce terminology |
| `prompt.includeScopeRule` | true | Asıl kaynak Diff; File yalnızca bağlam |
| `prompt.includeYkbDomainRules` | true | Breaking change, DTO, güvenlik, bankacılık kuralları |
| `prompt.includeExtraInstructions` | true | Sidebar **Ek talimatlar** |
| `prompt.includeEnvironment` | **false** | `javaHome` / `npmPath` (bulunursa) |
| `prompt.includeOutputFormat` | true | Çıktı başlıkları / findings-only + tek severity map |
| `prompt.includeChunkReminder` | true | User mesajı **sonunda** chunk notu (Diff’ten sonra) |
| `prompt.includeFileContents` | true | `#### File` bloğu; `false` ise yalnız Diff |

User mesajı sırası Diff-first: meta → `#### Diff` → file/related → unresolved/bridge → reminder. System sonunda **ÇIKTI KİLİDİ** (merge heading’leri). IDE assistant açıksa Qwen fail → Copilot’a sessiz düşmez.

`extraInstructions`: satır başına bir kural. Ayarlar view veya `settings.json`. `includeExtraInstructions` false ise modele gitmez.

`prompt.temperature` (varsayılan `0.2`) yalnızca IDE assistant (OpenAI-compatible) çağrısında kullanılır.

`javaHome` / `npmPath` boşsa sırayla Java/npm VS Code ayarları ve ortam değişkenlerinden çözülür (`JAVA_HOME`, `java.jdt.ls.java.home`, PATH tahmini).

---

## Komut paleti

`Ctrl+Shift+P` → kategori **YKB PR Reviewer Extended**:

| Komut | Açıklama |
|---|---|
| **Sol Paneli Ac** | Activity Bar panelini odaklar |
| **PR Review Basalt** | PR URL yapıştır → local md |
| **PR'a Comment At** | Seçili PR: review + satır comment + genel Critical comment |
| **PR Preview** | Seçili PR diff preview |
| **PR Approve** / **PR Unapprove** | Seçili PR |
| **Review Et** | Seçili PR → local md |
| **Onayimi Bekleyen PR'lari Listele** | Inbox QuickPick → local md |
| **Otomatik Review Ac/Kapat** | `autoReview.enabled` global toggle + status bar |
| **Otomatik Review'u Simdi Calistir** | Tek cycle (md yok, inbox inline comment) |
| **Dev Bulk Review Calistir** | Checked OPEN→dev PR: sil + yeniden post + sayaç +1 |
| **Code Review Calistir** | Checked OPEN→dev PR: 4 uzman + confidence + satır comment |
| **OCR Review Calistir** | Checked OPEN→dev PR: `ocr` CLI → local md + satır comment |
| **CRG Review Calistir** | Checked OPEN→dev PR: code-review-graph + LLM → local md + satır comment |
| **PR Agent Calistir** | Checked OPEN→dev PR: `pr-agent` plain-diff CLI → local md + satır comment |
| **Kullanilabilir Modelleri Listele** | Copilot modelleri; id panoya |
| **Bitbucket Token Kaydet** | Secret store |
| **Bitbucket Token'i Temizle** | Secret store sil |
| **Yenile** | İlgili liste |
| **PR / Repo Ara** / **Repo Sec** | Repo PR view |

Seçim yokken Review / Comment / Preview / Approve komutları paletten gizlenir (`ykbPrReviewerExtended.hasPrSelection`).

---

## Otomatik review

Ayarlar:

```json
"ykbPrReviewerExtended.autoReview.enabled": false,
"ykbPrReviewerExtended.autoReview.intervalMinutes": 5
```

- `enabled: true` ise VS Code açılışında ~10 sn sonra ilk cycle, sonra her N dakikada bir
- Status bar sağda: `Auto PR Review Ext` — tıklayınca aç/kapat
- Hedef: **Bana açılan** (REVIEWER) **OPEN** PR’lar
- Local md **yazılmaz**
- Zaten onayladığın / NEEDS_WORK bıraktığın PR’lar aday değil
- Marker’lı comment varsa atlanır
- `hmn*` / `hmnfe*` / `*-sql*` repo slug’ları filtrelenir (inbox listesi de aynı)
- Cycle bitince özet; **Detayları Gör** Output Channel’ı açar

---

## UI ölçekleri

Sidebar webview CSS değişkenleri (`settings.example.json`):

| Ayar | Varsayılan | Aralık |
|---|---|---|
| `ui.fontSizePx` | 12 | 8–32 |
| `ui.buttonSizePx` | 24 | 16–48 |
| `ui.iconSizePx` | 16 | 10–32 |
| `ui.paddingPx` | 8 | 2–24 |
| `ui.gapPx` | 4 | 2–16 |
| `ui.radiusPx` | 4 | 0–16 |

---

## Ayar özeti

Tam örnek: [`settings.example.json`](settings.example.json). Contribution: `package.json` → `contributes.configuration`.

**Bağlantı ve model**

| Key | Varsayılan | Not |
|---|---|---|
| `baseUrl` | YKB Bitbucket | Server kök URL |
| `token` | `""` | Boş bırakıp secret store tercih edin |
| `model` | `gpt-5.4-mini` | Copilot id/family (`use` false iken) |
| `aiIdeAssistant.use` | `false` | `true` → `ai-ide-assistant.providers` (Dev Bulk / Code Review / CRG) |
| `ai-ide-assistant.providers` | örnek Qwen | PR Agent LLM buradan okunur (`enabled: true`); `apiKey` boş bırakma |
| `extraInstructions` | `""` | Her review’a ek kural |
| `openPreview` | `true` | md sonrası Preview |

**Bulk paneller (CLI path boş = PATH / USERPROFILE python Scripts)**

| Key | Varsayılan | Panel |
|---|---|---|
| `ocrReview.executablePath` / `baseRef` / `timeoutMinutes` / `audience` | `""` / `origin/dev` / `30` / `agent` | OCR Review |
| `crgReview.executablePath` / `baseRef` / `timeoutMinutes` / `maxContextChars` | `""` / `origin/dev` / `30` / `120000` | CRG Review |
| `prAgentReview.executablePath` / `baseRef` / `timeoutMinutes` | `""` / `origin/dev` / `30` | PR Agent |

**Bütçe:** `maxDiffChars`, `maxPromptChars`, `maxFileChars` (yukarıda).

**Prompt dosya path’leri** (`prompt.files.*`): `skills-intro.md`, Superpowers skill’ler, `language-rule.md`, `scope-rule.md`, `ykb-domain-rules.md`, `output-format.md`, `findings-only-format.md`, `chunk-reminder.md`, `closing-notes.md`, `findings-only-chunk-note.md`.

Kısa heading / preamble / epilogue boşsa `prompt/defaults.json` kullanılır.

**IDE assistant (harici)** — bu eklentinin kendi key’i değil:

```json
"ai-ide-assistant.providers": [
  {
    "id": "qwen3-6",
    "name": "qwen3",
    "baseUrl": "https://…",
    "model": "cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit",
    "apiKey": "",
    "type": "openai",
    "enabled": true
  }
]
```

Chat URL: `baseUrl` → `/v1/chat/completions` (zaten `/v1` veya tam path ise düzeltilir).

---

## Log

Output Channel: **YKB PR Review Extended**. Review ve comment sırasında açılır. `authorization` / `apiKey` / `token` / `password` / `secret` alanları `***` ile maskelenir. SEND logunda modele giden `userText` (dosya içeriği dahil) yazılır; string tavanı 100000 karakterdir.

---

## Geliştirme notları

- Çalışan kod: `out/` (CommonJS). `main`: `./out/extension.js`
- Testler: `test/*.test.js` (Node `assert`, `out/` require)
- Paket: `node scripts/package-vsix.js` — `package.json`, `README.md`, `LICENSE.txt`, `out/`, `prompt/`, `skills/`, `media/`, `settings.example.json`, ikon
- Lisans: MIT (YKB, 2026)

Token ve API key’leri commit etmeyin. `settings.example.json` içindeki `apiKey` boş bırakılmıştır.
