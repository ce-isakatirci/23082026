# PR Review — #3157 Feature/cosmos sepa komisyon duzenlemeleri 070926

- **Repo:** COSSEPA/cosmos-sepa
- **Author:** Zülal Tekerci
- **Branch:** feature/cosmos-sepa-komisyon-duzenlemeleri-070926 → dev
- **Model:** qwen3 (cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit)
- **Generated:** 2026-09-13T08:12:05.419Z
- **Skills:** requesting-code-review

## Özet
Parça sayısı: 31. Critical bulgu var.

## Critical
1. **Test Endpoint'leri Production'a Açılıyor**
   - **Dosya:** `AccountingController.java:45`, `AccountingController.java:117`
   - **Sorun:** `incomingAccountingAGI_Test` ve `incomingReverseAccountingAGI_Test` metodları `@PostMapping` ile doğrudan HTTP endpoint'ine açılmış. Metod isimleri `_Test` ile bitiyor ancak bu bir `@Test` anotasyonu veya test sınıfı değil, canlı bir Controller. Bu endpoint'ler dışarıdan çağrılabilir durumda.
   - **Neden Kritik:** Bu endpoint'ler doğrudan veritabanı okuma/yazma (`IncomingTransactionRepository.save`) ve harici servis çağrısı (`NbsAdapterClient`) yapıyor. Hatalı bir payload ile yanlış hesaplar üzerinde komisyon hesaplaması veya accounting işlemi tetiklenebilir. Ayrıca `SYSTEM_GEN` user code ile işlem yapıyor, audit trail karmaşası yaratır.
   - **Önerilen kod:**
     ```java
     // Bu metodlar production controller'da olmamalı.
     // Ya bir @Service'e taşınmalı ya da @Test anotasyonu ile test sınıfına alınmalı.
     // Eğer debug amaçlıysa, @Profile("dev") veya @ConditionalOnProperty ile kısıtlanmalı.
     ```

2. **Transaction Yönetimi Eksik (Data Tutarlılığı Riski)**
   - **Dosya:** `AccountingController.java:45-100`, `AccountingController.java:117-155`
   - **Sorun:** Metodlar `@Transactional` anotasyonu içermiyor. `incomingAccountingAGI_Test` metodunda önce `serviceLocator.getNbsAdapterClient().incomingInstant(...)` çağrısı yapılıyor, başarılıysa `transaction.save()` yapılıyor. Ancak NBS çağrısı başarılı olup transaction save sırasında hata olursa veya tam tersi durumda, veritabanı ile harici sistem arasında tutarsızlık (inconsistency) oluşabilir.
   - **Neden Kritik:** Bankacılık işlemlerinde atomicity (atomiklik) şarttır. Accounting işlemi başarılı ama DB güncellemesi başarısız olursa, para transferi yapılmış ama sistemde "yapılmadı" olarak kalır veya tam tersi.
   - **Önerilen kod:**
     ```java
     @PostMapping("/incoming-accounting-instant")
     @Transactional // Transaction yönetimi eklenmeli
     public ResponseEntity<String> incomingAccountingAGI_Test(@RequestBody AccountingControllerDTO dto) {
         // ...
     }
     ```

3. **Null Pointer Exception (NPE) Riski**
   - **Dosya:** `AccountingController.java:48-50`
   - **Sorun:** `repositoryLocator.getIncomingTransactionWithoutRelationRepository().findBySepaTransactionId(...)` sonucu `null` olabilir. Kodda bu kontrol yok. Sonraki satırlarda `transaction.getCreditorIban()`, `transaction.getAmount()` gibi metodlar çağrılıyor. Eğer transaction bulunamazsa NPE fırlatılır.
   - **Neden Kritik:** 500 Internal Server Error'a yol açar. Client'a anlamlı bir hata mesajı dönmez.
   - **Önerilen kod:**
     ```java
     IncomingTransactionEntityWR transaction = repositoryLocator
             .getIncomingTransactionWithoutRelationRepository()
             .findBySepaTransactionId(dto.getSepaTransactionId());

     if (transaction == null) {
         log.warn("Transaction not found for id: {}", dto.getSepaTransactionId());
         return new ResponseEntity<>("Transaction not found", HttpStatus.NOT_FOUND);
     }
     ```

## Important
### 1. Entity alan uzunluğu tutarsızlığı (Commission Expense Account No)
- **Dosya:** `IncomingTransactionAuditEntity.java:52`
- **Bulgu:** `COMMISSION_EXPENSE_ACCOUNT_NO` alanı için `@Column` annotation'ında `length = 10` belirtilmiş, ancak `@Size(max = 12)` annotation'ı kullanılmış. Ayrıca `IncomingTransactionEntity` (bağlam dosyası) ve genel banka standartlarında IBAN veya hesap no uzunlukları genellikle 10-34 karakter arasındadır. 10 karakter, uluslararası hesap numaraları (IBAN) için yetersiz kalabilir.
- **Neden Önemli:** Veritabanı şeması (DB schema) ile Java entity mapping'i çelişiyor. Hibernate, veritabanı kolonunu oluştururken veya varolan şemayı doğrularken bu tutarsızlık nedeniyle deploy hatalarına veya veri kaybına yol açabilir.
- **Önerilen kod:**
```java
// Hesap numarası uzunluğunu domain gereksinimine göre (örn. 34 karakter IBAN max) güncelle
@Size(max = 34)
@Column(name = "COMMISSION_EXPENSE_ACCOUNT_NO", length = 34)
private String commissionExpenseAccountNo;
```

### 2. Entity alan uzunluğu tutarsızlığı (Commission Expense Account Ccy)
- **Dosya:** `IncomingTransactionAuditEntity.java:56`
- **Bulgu:** `COMMISSION_EXPENSE_ACCOUNT_CCY` alanı için `@Column` annotation'ında `length = 4` belirtilmiş, ancak `@Size(max = 4)` annotation'ı kullanılmış. ISO 4217 standartı 3 karakterdir (EUR, USD). 4 karakter tanımlanması, veritabanında gereksiz yer kaplar veya yanlışlıkla 4 karakterlik (geçersiz) bir ccy kodunun kaydedilmesine izin verebilir.
- **Neden Önemli:** Veri bütünlüğü ve standart uyumluluğu.
- **Önerilen kod:**
```java
@Size(max = 3)
@Column(name = "COMMISSION_EXPENSE_ACCOUNT_CCY", length = 3)
private String commissionExpenseAccountCcy;
```

### 3. Debug Log'un Production'da Performans Etkisi
- **Dosya:** `AccountingValidatorAGI.java:335`
- **Bulgu:** `log.info("getAccountingService transaction: {}", JsonUtil.toString(transaction));` satırı eklenmiş. `JsonUtil.toString(transaction)` çağrısı, büyük bir entity nesnesini (muhtemelen tüm ilişkili alanları içeren) JSON formatına serialize eder. Bu işlem CPU ve I/O açısından maliyetlidir.
- **Neden Önemli:** `INFO` seviyesindeki bu log, production ortamında yüksek trafikli SEPA işlemlerinde ciddi performans düşüşüne (GC pressure, CPU usage) neden olabilir. Ayrıca, `transaction` nesnesi PII (Kişisel Veri) içerebilir (IBAN, isim vb.), bu da GDPR/kurumsal güvenlik politikalarına aykırı olabilir.
- **Önerilen kod:**
```java
// Production'da kaldırılmalı veya DEBUG seviyesine çekilmeli.
// Eğer debug amaçlıysa:
if (log.isDebugEnabled()) {
    log.debug("getAccountingService transaction: {}", JsonUtil.toString(transaction));
}
// Veya sadece kritik alanları logla:
log.info("Transaction processed: id={}, status={}, amount={}", 
    transaction.getId(), transaction.getTransactionStatus(), transaction.getAmount());
```

#### 1. Entity ve Audit Entity arasında alan tutarsızlığı (Outgoing vs Incoming)
- **File:** `OutgoingTransactionAuditEntity.java`
- **Issue:** `IncomingTransactionEntity` ve `IncomingTransactionEntityWR` için `COMMISSION_EXPENSE_ACCOUNT_NO` ve `COMMISSION_EXPENSE_ACCOUNT_CCY` alanları eklenmiş. Ancak `OutgoingTransactionAuditEntity`'e bu alanlar eklenirken, `Incoming` tarafında olan `COMMISSION_CURRENCY` alanı `Outgoing` audit entity'sine de eklenmiş. `OutgoingTransactionEntity`'nin mevcut yapısı (diff'te görünmüyor ama domain mantığı) ile `Incoming` tarafındaki yeni alanlar örtüşmüyor. Eğer `Outgoing` tarafında komisyonun farklı hesaptan alınması gerekiyorsa, `OutgoingTransactionEntity`'ye de aynı alanlar eklenmeli ve bu audit entity buna uygun olmalı. Şu an `Outgoing` audit entity'sinde `COMMISSION_CURRENCY` var ama `COMMISSION_EXPENSE_ACCOUNT` alanları `Incoming`'deki gibi mi yoksa `Outgoing`'ye özgü mü? `Incoming`'de `COMMISSION_CURRENCY` zaten var (diff'te `IncomingTransactionEntity`'de `commissionCurrency` alanı mevcut). `OutgoingTransactionAuditEntity`'ye `COMMISSION_CURRENCY` eklenmiş ama `Incoming` tarafında bu alan zaten vardı. **Önemli:** `IncomingTransactionEntity`'de `COMMISSION_CURRENCY` zaten var, yeni eklenenler `CALCULATED_COMMISSION_AMOUNT`, `COMMISSION_EXPENSE_ACCOUNT_NO`, `COMMISSION_EXPENSE_ACCOUNT_CCY` ve `LOCAL_AMOUNT`. `OutgoingTransactionAuditEntity`'ye `COMMISSION_CURRENCY` eklenmiş bu doğru olabilir ama `COMMISSION_EXPENSE_ACCOUNT_NO` ve `COMMISSION_EXPENSE_ACCOUNT_CCY` alanlarının `Outgoing` tarafı için de gerekli olup olmadığı ve `OutgoingTransactionEntity`'ye de eklenip eklenmediği kontrol edilmeli. Eğer `Outgoing` tarafı için de bu alanlar gerekiyorsa, `OutgoingTransactionEntity`'ye de eklenmeli.
- **Why it matters:** Veri tutarlılığı ve audit kayıtlarının eksik olması.
- **How to fix:** `OutgoingTransactionEntity`'ye de aynı alanlar eklenmeli ve `OutgoingTransactionAuditEntity` buna uygun olmalı.

#### 2. `IncomingTransactionEntity` ve `IncomingTransactionEntityWR` arasında tutarsızlık
- **File:** `IncomingTransactionEntity.java`, `IncomingTransactionEntityWR.java`
- **Issue:** Her iki entity de aynı tabloya (`INCOMING_TRANSACTION`) mapped. `IncomingTransactionEntity`'de `@Audited` ve `@AuditTable` annotation'ları var. `IncomingTransactionEntityWR`'de de `@Audited` ve `@AuditTable` annotation'ları var. Bu, Hibernate Envers için çakışma yaratabilir. Genellikle bir entity audit edilir, diğerleri (WR - Write Request/Response?) audit edilmez veya farklı bir audit tablosuna mapped edilir. Eğer `IncomingTransactionEntityWR` de audit ediliyorsa, `@AuditTable` değeri farklı olmalı veya `IncomingTransactionEntityWR` audit edilmemeli.
- **Why it matters:** Audit kayıtlarının karışması veya hatalı olması.
- **How to fix:** `IncomingTransactionEntityWR` için `@AuditTable` değerini kontrol et veya audit'i kaldır.

### DTO Package Refactoring ve Namespace Çakışması Riski
- **File:** `src/main/java/com/ykb/nl/sepa/dto/ExchangeParityByRateConvertRequestDTO.java`, `ExchangeParityConvertRequestDTO.java`, `ExchangeParityConvertResponseDTO.java`
- **Issue:** `com.ykb.nl.sepa.dto.accounting` paketindeki `AccountingServiceResponseDTO` sınıfı silinmiş ve yerine `com.ykb.nl.sepa.dto` paketinde yeni sınıflar (`ExchangeParity...`) eklenmiş. Bu, `AccountingServiceResponseDTO`'yu kullanan diğer servisler veya DTO'lar için **Breaking Change** oluşturur. Eğer başka bir modül bu DTO'yu import ediyorsa derleme hatası alacaktır.
- **Why it matters:** Paket yapısı değişikliği, bağımlılık yönetimini bozar ve compile-time error'a yol açar.
- **How to fix:** `AccountingServiceResponseDTO` kullanan tüm import satırlarını kontrol edin. Eğer bu DTO artık kullanılmıyorsa, ilgili referansları temizleyin. Eğer kullanılıyorsa, migration planı yapın.

### CalcCommissionDto Alan İsimlendirme Standartları
- **File:** `src/main/java/com/ykb/nl/sepa/dto/CalcCommissionDto.java`
- **Issue:** Alan adları (`comAmt`, `commGL`, `commCcy`) kısaltma içeriyor ve standart Java naming convention'ına (camelCase, açıklayıcı) tam uymuyor. Ayrıca `cif` (Customer Information File) gibi bankacılık terimi büyük harfle yazılmalı veya netleştirilmeli.
- **Why it matters:** Kod okunabilirliği düşer, bakım zorlaşır.
- **Önerilen kod:**
```java
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class CalcCommissionDto {
    private Long cif;
    private BigDecimal commissionAmount;
    private String commissionGlAccount;
    private String transactionCurrency;
    private BigDecimal transactionAmount;
    private String residenceCountry;
    private String commissionCurrency;
    private String errorMessage;
}
```

### CheckDuplicateAndBalanceRequestDTO Validasyon Eksikliği
- **File:** `src/main/java/com/ykb/nl/sepa/dto/CheckDuplicateAndBalanceRequestDTO.java`
- **Issue:** Yeni eklenen `commissionCurrency`, `commissionExpenseAccountNo`, `commissionExpenseAccountCcy` alanlarına validasyon annotation'ı (`@NotBlank`, `@Size`) eklenmemiş.
- **Why it matters:** Bu alanlar zorunlu ise backend'e null veya boş string gelebilir, downstream işlemlerde NullPointerException veya veritabanı constraint violation'a neden olabilir.
- **How to fix:** Alanların zorunluluğuna göre `@NotBlank` veya `@NotNull` ekleyin.

### 1. `IncomingTransactionDTO` ve `OutgoingTransactionDTO`'da `localAmount` alanı eksik validasyon
**File:** `IncomingTransactionDTO.java` / `OutgoingTransactionDTO.java`
**Issue:** `localAmount` alanı `BigDecimal` olarak eklenmiş ancak `@NotNull` veya `@DecimalMin` gibi validasyon anotları eklenmemiş. SEPA transferlerinde yerel tutarın (local amount) zorunlu ve pozitif olması beklenir. Eksik validasyon, downstream servislerde `NullPointerException` veya mantıksal hatalara yol açabilir.
**Önerilen kod:**
```java
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

// ...
@NotNull
@DecimalMin(value = "0.00", inclusive = false, message = "Local amount must be greater than zero")
private BigDecimal localAmount;
```

### 2. `AccountingControllerDTO`'da kritik alanların silinmesi ve tip değişikliği
**File:** `AccountingControllerDTO.java`
**Issue:** `AccountingServiceRequestDTO`'dan farklı olarak `AccountingControllerDTO`'da `amount`, `commissionAmount`, `chargeAmount` alanları silinmiş ve `Double` yerine `BigDecimal` kullanılmamış. Ayrıca `overdraft` ve `userCode` gibi hardcoded değerler kaldırılmış. Bu DTO, muhtemelen bir Controller input'u olarak kullanılıyorsa, bu alanların eksikliği downstream `AccountingService` çağrılarında `NullPointerException` veya yanlış hesaplama (Double precision issues) riski taşır. `Double` yerine `BigDecimal` kullanımı bankacılıkta standarttır, ancak mevcut kodda `AccountingServiceRequestDTO` hala `Double` kullanıyor. Tutarlılık ve precision kaybı riski var.
**Önerilen kod:**
```java
// AccountingControllerDTO içinde
import java.math.BigDecimal;

// ...
@NotNull
private BigDecimal amount;
private BigDecimal commissionAmount;
private BigDecimal chargeAmount;
```

### 3. `OutgoingTransactionIntbankDTO` ve `OutgoingTransactionIntbankQueryResponseDTO`'da tutarsızlık
**File:** `OutgoingTransactionIntbankDTO.java` / `OutgoingTransactionIntbankQueryResponseDTO.java`
**Issue:** `OutgoingTransactionIntbankDTO`'ya `localAmount`, `calculatedCommissionAmount` gibi alanlar eklenirken, `OutgoingTransactionIntbankQueryResponseDTO`'ya sadece `commissionCurrency`, `commissionExpenseAccountNo`, `commissionExpenseAccountCcy` eklenmiş. `localAmount` ve `calculatedCommissionAmount` query response'ta eksik. Eğer bu DTO, client'a dönen bir response ise, client bu yeni alanları göremeyecek.
**Önerilen kod:**
```java
// OutgoingTransactionIntbankQueryResponseDTO.java
private BigDecimal localAmount;
private BigDecimal calculatedCommissionAmount;
```

### 1. `SepaDTO`'ya eklenen alanların `SepaAccountingDto` ile tutarsızlığı
- **File:** `src/main/java/com/ykb/nl/sepa/external/dto/SepaDTO.java`
- **Issue:** `SepaDTO`'ya `commissionExpenseAccountNo` ve `commissionExpenseAccountCcy` eklenmiş. Ancak `SepaAccountingDto`'da (ki muhtemelen bu veriler oraya işleniyor) `comAccount` ve `comCcy` alanları var. Ayrıca `SepaAccountingDto`'ya `fccaBaseEqu`, `convComAmount` gibi yeni `BigDecimal` alanlar eklenmiş. Bu alanların `SepaDTO`'dan `SepaAccountingDto`'ya mapping (dönüşüm) sırasında doğru eşleştirildiğinden emin olunmalı. Özellikle `SepaDTO`'da `commissionExpenseAccountNo` (String) iken `SepaAccountingDto`'da `comAccount` (String) olarak eşleşiyor gibi görünüyor, ancak `SepaAccountingDto`'daki yeni `BigDecimal` alanlarının (`fccaBaseEqu`, `convComAmount`) `SepaDTO`'da karşılığı yok. Bu, komisyon hesap/para birimi dışında kalan komisyon tutarlarının kaybolmasına veya yanlış hesaplanmasına neden olabilir.
- **Why it matters:** Veri kaybı veya yanlış muhasebeleştirme riski.
- **Önerilen kod:**
```java
// SepaAccountingDto'ya mapping yapan servis katmanında bu alanların nasıl doldurulduğunu kontrol et.
// SepaDTO'da bu alanlar yoksa, null gelebilir veya default değerle gelebilir.
// SepaAccountingDto.fccaBaseEqu ve convComAmount için SepaDTO'da karşılık yoksa,
// bu alanların nereden geldiği (muhtemelen başka bir servis veya hesaplama) belirlenmeli.
```

### 2. `AccountServiceImpl.getAccountList` metodunda `currencyCodes` listesi null pointer riski
- **File:** `src/main/java/com/ykb/nl/sepa/service/AccountServiceImpl.java`
- **Issue:** `accountRequest.getCurrencyCodes().add("ALL");` satırında `accountRequest.getCurrencyCodes()` metodunun `null` döndürmesi durumunda `NullPointerException` fırlatılabilir. `AccountRequest` DTO'sunun constructor'ında veya field initialization'ında `currencyCodes` listesi `new ArrayList<>()` ile başlatılmamışsa bu risk vardır.
- **Why it matters:** Runtime error.
- **Önerilen kod:**
```java
// AccountRequest sınıfında currencyCodes alanının başlatıldığından emin olun.
// Eğer başlatılmamışsa:
// private List<String> currencyCodes = new ArrayList<>();

// Veya servis katmanında:
if (accountRequest.getCurrencyCodes() == null) {
    accountRequest.setCurrencyCodes(new ArrayList<>());
}
accountRequest.getCurrencyCodes().add("ALL");
```

### 3. `NbsAdapterClient`'a eklenen endpoint'in `@Operation` annotation'ı eksikliği
- **File:** `src/main/java/com/ykb/nl/sepa/external/client/NbsAdapterClient.java`
- **Issue:** `convertExchangeParityAmountByRate` metodu için `@Operation` annotation'ı eklenmiş ancak bu annotation genellikle Swagger/OpenAPI dokümantasyonu için kullanılır. Eğer bu bir `FeignClient` interface'i ise, `@Operation` annotation'ı genellikle `springdoc-openapi` tarafından işlenir. Ancak, `FeignClient` interface'lerinde `@Operation` kullanımı, dokümantasyonun doğru oluşturulması için önemlidir. Bu annotation'ın doğru paketten import edildiğinden ve `springdoc` tarafından tanındığından emin olun. Ayrıca, bu endpoint'in request/response DTO'ları (`ExchangeParityByRateConvertRequestDTO`, `ExchangeParityConvertResponseDTO`) doğru şekilde dokümante edilmeli.
- **Why it matters:** API dokümantasyonunun eksik veya yanlış olması.
- **Önerilen kod:**
```java
// Import kontrolü:
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

// Metod için daha detaylı annotation:
@Operation(summary = "Convert Exchange Parity Amount by Rate", description = "Converts amount using exchange parity rate")
@PostMapping(path = "/currency-exchange/parity/convert-by-rate")
ResponseEntity<SepaBaseResponse<ExchangeParityConvertResponseDTO>> convertExchangeParityAmountByRate(@RequestBody ExchangeParityByRateConvertRequestDTO request);
```

1. **Gereksiz `@Transactional` kullanımı**
   - **Dosya:** `AccountingExternalService.java:18`
   - **Sorun:** Sınıf seviyesinde `@Transactional` annotasyonu mevcut. Ancak `convertAmount` metodu harici bir servise (NBS Adapter) çağrı yapıyor ve veritabanı işlemi içermiyor. Harici servis çağrıları için transaction yönetimi genellikle gereksizdir ve gereksiz lock'lamaya veya timeout'lara yol açabilir.
   - **Öneri:** Sınıf seviyesindeki `@Transactional` annotasyonunu kaldırın. Eğer bu servis başka transactional metotlar içeriyorsa, sadece onları `@Transactional` ile işaretleyin.

    ```java
    @Service
    @Slf4j
    @AllArgsConstructor
    // @Transactional // Kaldırılmalı veya sadece DB işlemleri yapan metotlarda kullanılmalı
    public class AccountingExternalService {
    ```

2. **Hata durumunda `null` döndürülmesi**
   - **Dosya:** `AccountingExternalService.java:39`
   - **Sorun:** `catch` bloğunda hata yakalanıp `null` döndürülüyor. Çağrı yapan taraf, dönüş değerinin `null` olup olmadığını kontrol etmek zorunda kalacak ve bu durum `NullPointerException` riski taşıyor. Ayrıca, komisyon hesaplama gibi kritik bir işlemde sessizce `null` dönmek, iş akışının bozulmasına ve verinin kaybolmasına neden olabilir.
   - **Öneri:** Hata durumunda anlamlı bir exception fırlatın veya en azından işlemi başarısız kılın.

    ```java
        } catch (Exception e) {
            log.error("AccountingExternalService convertAmount exception: {}", ExceptionUtil.convertStackTraceToString(e));
            // null yerine exception fırlatılmalı veya özel bir durum döndürülmeli
            throw new RuntimeException("Currency conversion failed", e);
        }
    ```

1. **`setCommissionFields` metodunda exception handling mantığı hatalı**
   - **Dosya:** `AccountingServiceImpl.java:120-135`
   - **Sorun:** `setCommissionFields` metodu içindeki `try-catch` bloğu, bir hata durumunda `request` nesnesindeki komisyon alanlarını `0` veya `""` olarak set ediyor. Ancak bu metot `outgoingTransaction` içinde çağrılıyor ve `outgoingTransaction` metodu genel bir `try-catch` ile sarılı. `setCommissionFields` içindeki exception'ı yakalayıp "sıfırlama" yapmak, aslında `outgoingTransaction` metodunun genel catch bloğuna düşmesini engelliyor. Bu, hata durumunun loglanmasını ve doğru işlenmesini (örneğin transaction rollback veya specific error handling) zorlaştırabilir. Ayrıca, `request.setComAccount("")` gibi işlemler, downstream sistemin (NBS) bu boş değerleri nasıl yorumlayacağını belirsizleştirir.
   - **Neden Önemli:** Hata yönetimi tutarsızlığı, beklenmedik davranışlara veya debug'ın zorlaşmasına yol açabilir.
   - **Önerilen Kod:**
     ```java
     // setCommissionFields içindeki try-catch kaldırılmalı veya daha spesifik exception'lar fırlatılmalı
     // Alternatif: setCommissionFields içinde hata olursa, exception'ı yakalamadan fırlatmak veya
     // downstream'e özel bir error flag/code set etmek daha temiz olabilir.
     // Şimdilik, catch bloğunda sadece loglama yapıp, değerleri null bırakmak daha güvenli olabilir:
     catch (Exception e) {
         log.error("setCommissionFields failed for transaction: {}", transactionDto.getId(), e);
         request.setFccaBaseEqu(null);
         request.setComAccount(null);
         request.setComCcy(null);
         request.setConvComAmount(null);
     }
     ```

2. **`setConvComAmount` ve `findBaseEqu` metodlarında `BigDecimal` sıfır değeri kullanımı**
   - **Dosya:** `AccountingServiceImpl.java:137-156` ve `158-169`
   - **Sorun:** Her iki metot da `BigDecimal.valueOf(0)` ile başlıyor. Bu, özellikle `findBaseEqu` için sorunlu olabilir. Eğer `accountingExternalService.convertAmount` başarısız olursa veya `commissionCurrency`/`commissionAmount` null ise, `0` döndürülür. Bu `0` değeri, downstream sisteme "komisyon yok" veya "dönüştürülemeyen komisyon" anlamında yanlış bir sinyal gönderebilir. `null` kullanımı, "bilgi yok" anlamını daha net ifade eder.
   - **Neden Önemli:** Yanlış `0` değeri, downstream sistemin yanlış hesaplamalar yapmasına veya yanlış loglamalar üretmesine neden olabilir.
   - **Önerilen Kod:**
     ```java
     // setConvComAmount ve findBaseEqu metodlarında başlangıç değeri olarak null kullanılmalı
     BigDecimal convComAmount = null; // veya BigDecimal.ZERO ama null daha iyi
     // ...
     // catch bloklarında da null set edilmeli
     ```

3. **`saveCalculatedCommissionFields` metodunun amacının belirsizliği**
   - **Dosya:** `AccountingServiceImpl.java:603-612`
   - **Sorun:** `saveCalculatedCommissionFields` metodu, `request` (AccountingServiceRequestDTO) ve `response` (AccountingServiceResponseDTO) nesnelerindeki komisyon alanlarını kopyalıyor. Ancak bu metot, `outgoingTransaction` metodu içinde çağrılıyor ve `response` nesnesi daha sonra `repositoryLocator.getOutgoingTransactionRepositoryWR().save(outgoingTransaction)` çağrısına kadar kullanılmıyor. Bu kopyalama işlemi, `response` nesnesinin downstream'e gönderilmeden önce "zenginleştirilmesi" için yapılıyor. Ancak, `response` nesnesi doğrudan `nbsAdapterClient`'a gönderilmiyor; `request` nesnesi gönderiliyor. Bu kopyalama, `response` nesnesinin downstream'e gönderilmeden önce "zenginleştirilmesi" için yapılıyor. Ancak, `response` nesnesi doğrudan `nbsAdapterClient`'a gönderilmiyor; `request` nesnesi gönderiliyor. Bu kopyalama, gereksiz ve kafa karıştırıcı.
   - **Neden Önemli:** Kodun okunabilirliği ve bakımı zorlaşır. Amacı net değil.
   - **Önerilen Kod:**
     ```java
     // Bu metodun ne işe yaradığı net değil. Eğer response nesnesi downstream'e gönderilecekse,
     // bu kopyalama işlemi, response nesnesinin oluşturulduğu yerde yapılmalı.
     // Eğer response nesnesi downstream'e gönderilmiyorsa, bu kopyalama gereksizdir.
     // Mevcut kodda, response nesnesi doğrudan nbsAdapterClient'a gönderilmiyor.
     // Bu nedenle, bu metodun kaldırılması veya amacının netleştirilmesi gerekiyor.
     ```

### 1. `setCommissionExpenseAccountAndCurrency` metodunda `IndexOutOfBoundsException` riski
- **Dosya:** `AccountingServiceImplAGI.java`
- **Satır:** `setCommissionExpenseAccountAndCurrency` metodu içinde `activeAccounts.get(0)`
- **Açıklama:** `activeAccounts` listesi boş olduğunda (`CollectionUtils.isEmpty(activeAccounts)`), loglama yapıldıktan sonra kod akışı devam eder ve `activeAccounts.get(0)` satırında `IndexOutOfBoundsException` fırlatılır. `else if` bloğu içinde `return` veya `throw` eksik.
- **Önerilen kod:**
```java
            } else if (CollectionUtils.isEmpty(activeAccounts)) {
                log.error("setCommissionExpenseAccount getAccountListByIban No active account found!  - incomingTransaction: {}", JsonUtil.toString(incomingTransactionDTO));
                // Hata durumunda işlemi sonlandır veya varsayılan değerlerle devam et
                incomingTransaction.setCommissionExpenseAccountNo("");
                incomingTransaction.setCommissionExpenseAccountCcy("");
                return; // veya throw new SepaException(...)
            }
```

### 2. `setCommissionExpenseAccountAndCurrency` metodunda `NullPointerException` riski
- **Dosya:** `AccountingServiceImplAGI.java`
- **Satır:** `activeAccounts.get(0).getCurrencyCode()`
- **Açıklama:** `activeAccounts` listesi dolu olsa bile, listedeki ilk eleman (`acc`) `null` olabilir veya `acc.getCurrencyCode()` `null` dönebilir. `StringUtil.nvl` ile korunmamış bu kullanım NPE'ye yol açabilir.
- **Önerilen kod:**
```java
            String creditorAccountCurrency = StringUtil.nvl(
                activeAccounts.isEmpty() ? null : activeAccounts.get(0).getCurrencyCode(), 
                ""
            );
```

### 3. `applyCalculatedCommission` metodunda `BigDecimal` dönüşümünde `NumberFormatException` riski
- **Dosya:** `AccountingServiceImplAGI.java`
- **Satır:** `BigDecimal.valueOf(findCommissionResponseBody.getData().getCommission())`
- **Açıklama:** `findCommissionResponseBody.getData().getCommission()` metodu `double` veya `float` döndürüyorsa, `BigDecimal.valueOf(double)` kullanımı hassasiyet kaybına neden olabilir. Ayrıca, eğer bu değer `null` ise `NullPointerException` fırlatır. `FindCommissionResponseDTO` yapısına bağlı olarak `null` kontrolü eksik.
- **Önerilen kod:**
```java
             if (findCommissionResponseBody != null && findCommissionResponseBody.getData() != null) {
                 Double commissionValue = findCommissionResponseBody.getData().getCommission();
                 if (commissionValue != null) {
                     incomingTransaction.setCommissionAmount(BigDecimal.valueOf(commissionValue));
                 } else {
                     incomingTransaction.setCommissionAmount(BigDecimal.ZERO);
                 }
                 incomingTransaction.setCommissionCurrency("EUR");
                 setCommissionExpenseAccountAndCurrency(incomingTransaction);
                 return findCommissionResponseBody.getData();
             }
```

### 4. `findCommission` metodunda `null` döndürme ve exception handling
- **Dosya:** `AccountingServiceImplAGI.java`
- **Satır:** `findCommission` metodu
- **Açıklama:** `nbsAdapterClient.getFindCommission(...)` çağrısında `null` dönerse veya `getBody()` `null` dönerse, metot `null` döndürür. Bu durum, çağran taraf (`applyCalculatedCommission`) tarafından `null` kontrolü ile yönetilse de, exception durumunda da `null` döndürülmesi hata ayıklamayı zorlaştırabilir. Ayrıca, `findCommissionResponseBody.getData()` `null` ise `incomingTransaction.setCommissionAmount` çağrılmaz, bu da tutarsız bir duruma yol açabilir.
- **Önerilen kod:**
```java
             SepaBaseResponse<FindCommissionResponseDTO> findCommissionResponseBody = nbsAdapterClient
                     .getFindCommission(findCommissionRequestDTO).getBody();

             if (findCommissionResponseBody != null && findCommissionResponseBody.getData() != null) {
                 Double commissionValue = findCommissionResponseBody.getData().getCommission();
                 if (commissionValue != null) {
                     incomingTransaction.setCommissionAmount(BigDecimal.valueOf(commissionValue));
                 }
             } else {
                 // Veri yoksa komisyon sıfırlanmalı mı?
                 incomingTransaction.setCommissionAmount(BigDecimal.ZERO);
             }
```

### 1. `OutgoingTransactionIntbankService`'de `setCommissionDetails` metodu gereksiz try-catch bloğu ile exception'ı gizliyor
- **Dosya:** `OutgoingTransactionIntbankService.java:524-535`
- **Sorun:** Metot içindeki `try-catch` bloğu `Exception`'ı yakalayıp sadece logluyor. Bu, `transactionDto`'nun yanlış veya eksik set edilmesine neden olursa, hata sessizce yutulur ve transaction yanlış veri ile devam eder. Bankacılık işlemlerinde bu tür "silent failures" veri tutarsızlığına yol açar.
- **Öneri:** `try-catch` bloğunu kaldırın veya en azından `RuntimeException` fırlatın.
```java
private void setCommissionDetails(OutgoingTransactionDTO transactionDto, OutgoingTransactionIntbankDTO dto) {
    log.info("OutgoingTransactionIntbankService setCommissionDetails dto: {}", JsonUtil.toString(dto));
    if (dto.getCommissionAmount() != null && BigDecimal.ZERO.compareTo(dto.getCommissionAmount()) != 0) {
        transactionDto.setCommissionCurrency(dto.getCommissionCurrency() != null ? dto.getCommissionCurrency() : "EUR");
    }
    transactionDto.setCommissionExpenseAccountNo(dto.getCommissionExpenseAccountNo() != null ? dto.getCommissionExpenseAccountNo() : "");
    transactionDto.setCommissionExpenseAccountCcy(dto.getCommissionExpenseAccountCcy() != null ? dto.getCommissionExpenseAccountCcy() : "");
    log.info("OutgoingTransactionIntbankService setCommissionDetails transactionDto: {}", JsonUtil.toString(transactionDto));
}
```

### 2. `OutgoingTransactionMapperService`'de `getExpenseAccountInformations` metodu `Exception`'ı gizleyerek boş DTO dönüyor
- **Dosya:** `OutgoingTransactionMapperService.java:26-46`
- **Sorun:** `accountService.getAccountList` çağrısı sırasında bir hata oluşursa, metot boş bir `AccountResponseDTO` döndürür. Bu, komisyon hesabı bilgisi eksik kalan bir transaction'ın işlemeye devam etmesine neden olabilir. Ayrıca log mesajında sınıf adı yanlış (`OutgoingTransactionActionService` yerine `OutgoingTransactionMapperService` olmalı).
- **Öneri:** Hata durumunda exception'ı fırlatın veya en azından kritik bir hata olarak loglayın. Log mesajındaki sınıf adını düzeltin.
```java
private AccountResponseDTO getExpenseAccountInformations(OutgoingTransactionDTO transactionDTO) {
    try {
        ResponseEntity<SepaBaseResponse<List<AccountResponseDTO>>>
                accountList = accountService.getAccountList(transactionDTO.getClientNo());
        if (Objects.isNull(accountList)) {
            return new AccountResponseDTO();
        }
        SepaBaseResponse<List<AccountResponseDTO>> body = accountList.getBody();
        if (body != null && transactionDTO.getCommissionExpenseAccountNo() != null) {
            List<AccountResponseDTO> responseDTOList = body.getData();
            if (Objects.isNull(responseDTOList)) {
                return new AccountResponseDTO();
            }
            Optional<AccountResponseDTO> accountResponseDTO = responseDTOList.stream()
                    .filter(accountInfo -> accountInfo.getAccountNumber().equals(transactionDTO.getCommissionExpenseAccountNo()))
                    .findAny();
            if (accountResponseDTO.isPresent()) {
                return accountResponseDTO.get();
            }
        }
        return new AccountResponseDTO();
    } catch (Exception e) {
        log.error("OutgoingTransactionMapperService getExpenseAccountInformations has error e: {}", ExceptionUtil.convertStackTraceToString(e));
        throw new RuntimeException("Failed to get expense account information", e); // Veya uygun bir custom exception
    }
}
```

### 3. `OutgoingTransactionMapperService`'de `handleCommissionExpenseAccount` metodu boş DTO kontrolü yapmıyor
- **Dosya:** `OutgoingTransactionMapperService.java:56-61`
- **Sorun:** `getExpenseAccountInformations` metodu hata durumunda veya hesap bulunamadığında boş bir `AccountResponseDTO` döndürür. `handleCommissionExpenseAccount` metodu bu boş DTO'nun alanlarına erişip `transaction`'ı set eder. Bu, `null` değerlerin entity'ye yazılmasına neden olabilir.
- **Öneri:** `expenseAccountInformations` nesnesinin geçerli olup olmadığını kontrol edin.
```java
private void handleCommissionExpenseAccount(OutgoingTransactionEntity transaction, OutgoingTransactionDTO transactionDTO) {
    log.info("OutgoingTransactionMapperService handleCommissionExpenseAccount transactionDTO: {}", JsonUtil.toString(transactionDTO));
    AccountResponseDTO expenseAccountInformations = getExpenseAccountInformations(transactionDTO);
    log.info("OutgoingTransactionMapperService handleCommissionExpenseAccount expenseAccountInformations: {}", JsonUtil.toString(expenseAccountInformations));
    if (expenseAccountInformations != null && 
        expenseAccountInformations.getAccountNumber() != null && 
        expenseAccountInformations.getCurrencyCode() != null) {
        transaction.setCommissionExpenseAccountNo(expenseAccountInformations.getAccountNumber());
        transaction.setCommissionExpenseAccountCcy(expenseAccountInformations.getCurrencyCode());
    }
}
```

### 1. `setCommissionExpenseAccountNoAndCurrency` metodu gereksiz try-catch bloğu ve null kontrolü
`OutgoingTransactionProxyService` içindeki yeni metot, setter çağrılarını `try-catch` içine almış ve setter argümanları için `!= null` kontrolü yapmış.
- `setCommissionExpenseAccountNo` ve `setCommissionExpenseAccountCcy` setter'ları genellikle basit field assignment yapar; `NullPointerException` fırlatmazlar (argüman null olsa bile).
- Bu try-catch bloğu, setter içindeki olası bir bug'ı (ki bu çok düşük ihtimal) yakalar ama `model`'den veri çekme hatasını (null pointer) gizler veya yanlış loglar.
- Ayrıca `model.get...() != null ? model.get...() : null` ifadesi gereksizdir; setter null kabul ediyorsa direkt `model.get...()` geçilebilir.

**Önerilen kod:**
```java
private void setCommissionExpenseAccountNoAndCurrency(OutgoingTransactionDTO outgoingTransactionDTO, SepaDTO model) {
    // Setter'lar null değerleri kabul ediyorsa try-catch ve null-check gereksizdir.
    // Eğer setter null kabul etmiyorsa, NPE burada oluşur ve doğru yerde loglanır.
    outgoingTransactionDTO.setCommissionExpenseAccountNo(model.getCommissionExpenseAccountNo());
    outgoingTransactionDTO.setCommissionExpenseAccountCcy(model.getCommissionExpenseAccountCcy());
}
```

### 2. `setCommissionDetails` metodunda `BigDecimal.ZERO` karşılaştırma mantığı hatası
`OutgoingTransactionServiceImpl` içindeki `setCommissionDetails` metodunda:
`if (dto.getCommissionAmount() != null && BigDecimal.ZERO.compareTo(dto.getCommissionAmount()) != 0)`
- `BigDecimal.ZERO.compareTo(dto.getCommissionAmount()) != 0` ifadesi, `commissionAmount`'ın **sıfır olmadığı** durumları kontrol eder.
- Ancak, komisyon tutarı 0 olsa bile (örneğin promosyon), `commissionCurrency` ve `expenseAccount` bilgileri veritabanından (`tran`) DTO'ya kopyalanmalıdır.
- Bu mantık, komisyon tutarı 0 olan işlemlerde komisyon detaylarının (para birimi, gider hesabı) DTO'ya yazılmasını engeller. Bu, "komisyonun farklı hesap/ccyden alınabilir olması" gereksinimiyle çelişir; çünkü 0 komisyonlu işlemlerde bile bu bilgiler downstream sistemlere (örneğin muhasebe) iletilemiyor olabilir.

**Önerilen kod:**
```java
private void setCommissionDetails(OutgoingTransactionIntbankQueryResponseDTO dto, OutgoingTransactionEntity tran) {
    try {
        log.info("OutgoingTransactionServiceImpl setCommissionDetails tran: {}", JsonUtil.toString(tran));
        
        // Komisyon tutarı 0 olsa bile, currency ve expense account bilgileri doldurulmalı
        if (dto.getCommissionAmount() != null) {
             dto.setCommissionCurrency(tran.getCommissionCurrency() != null ? tran.getCommissionCurrency() : "EUR");
        }
        
        dto.setCommissionExpenseAccountNo(tran.getCommissionExpenseAccountNo() != null ? tran.getCommissionExpenseAccountNo() : "");
        dto.setCommissionExpenseAccountCcy(tran.getCommissionExpenseAccountCcy() != null ? tran.getCommissionExpenseAccountCcy() : "");
        
        log.info("OutgoingTransactionServiceImpl setCommissionDetails dto: {}", JsonUtil.toString(dto));
    } catch (Exception e) {
        log.error("OutgoingTransactionServiceImpl setCommissionDetails Error while setting commission details for transaction ID {}: {}", tran.getId(), e.getMessage(), e);
    }
}
```

1. **`handleCommissionValues` metodunda gereksiz null kontrolü ve transaction save işlemi**
   - **Dosya:** `OutgoingTransactionActionService.java:170-174`
   - **Bulgular:** `handleCommissionValues` metodu içinde `transaction` nesnesi için null kontrolü yapılıyor (`if (transaction != null)`). Ancak bu metod `submitTransaction` içinde `transaction` null olmayan bir durumda çağrılıyor. Ayrıca, `insertCommissionDetails` metodu muhtemelen transaction'ı güncelliyorsa, `repositoryLocator.getOutgoingTransactionRepository().save(transaction)` çağrısı gereksiz yere DB hit'i oluşturabilir veya `insertCommissionDetails` zaten save işlemi yapıyorsa duplicate save hatasına yol açabilir.
   - **Önerilen kod:**
     ```java
     private void handleCommissionValues(OutgoingTransactionDTO transactionDTO, OutgoingTransactionEntity transaction) {
         // transaction null kontrolü submitTransaction içinde zaten yapıldığı için burada gerekli değil
         // insertCommissionDetails metodu save işlemi yapıyorsa, burada save çağrısını kaldır
         outgoingTransactionMapperService.insertCommissionDetails(transaction, transactionDTO);
         // Eğer insertCommissionDetails save yapmıyorsa, save işlemi burada kalmalı ama null check kaldırılmalı
     }
     ```

2. **`setCommissionDetails` metodunda catch bloğunda exception'ın loglanması ve devam edilmesi**
   - **Dosya:** `OutgoingTransactionActionService.java:1045-1047`
   - **Bulgular:** `setCommissionDetails` metodu içinde bir exception yakalanıp loglanıyor ancak işlem devam ettiriliyor. Bu, komisyon detaylarının set edilememesi durumunda transaction'ın eksik veya hatalı bir durumda kaydedilmesine neden olabilir. Bankacılık işlemlerinde kritik verilerin (komisyon) eksik set edilmesi ciddi bir veri tutarsızlığına yol açabilir.
   - **Önerilen kod:**
     ```java
     private void setCommissionDetails(OutgoingTransactionEntity screenTx, CheckDuplicateAndBalanceRequestDTO request) {
         if (screenTx.getCommissionAmount() != null && BigDecimal.ZERO.compareTo(screenTx.getCommissionAmount()) != 0) {
             screenTx.setCommissionCurrency(request.getCommissionCurrency() != null ? request.getCommissionCurrency() : "EUR");
             screenTx.setCommissionExpenseAccountNo(request.getCommissionExpenseAccountNo() != null ? request.getCommissionExpenseAccountNo() : "");
             screenTx.setCommissionExpenseAccountCcy(request.getCommissionExpenseAccountCcy() != null ? request.getCommissionExpenseAccountCcy() : "");
             log.info("resolveTransactions setCommissionDetails screenTx:{}", JsonUtil.toString(screenTx));
         }
     }
     ```

1. **Gereksiz Import ve Kullanılmayan Değişkenler**
   - **Dosya:** `AccountingController.java:1-167`
   - **Sorun:** 
     - `AccountResponseDTO account` değişkeni `incomingAccountingAGI_Test` metodunda oluşturuluyor ama sadece `account.getCurrencyCode()` için kullanılıyor. `accounting.setCcy(account.getCurrencyCode())` satırında kullanılıyor. Ancak `account` nesnesi gereksiz yere newlenmiş. Direkt `dto.getCurrencyCode()` kullanılabilirdi.
     - `IncomingTransactionEntity` import edilmiş ama `incomingAccountingAGI_Test` metodunda `IncomingTransactionEntityWR` kullanılıyor. `updateTransactionStatusReversed` metodunda `IncomingTransactionEntity` kullanılıyor. Bu karışıklık tip güvenliğini zayıflatır.
   - **Önerilen kod:**
     ```java
     // account nesnesi yerine direkt dto kullan
     accounting.setCcy(dto.getCurrencyCode());
     ```

2. **Hata Yönetimi ve Response Handling**
   - **Dosya:** `AccountingController.java:90-95`, `AccountingController.java:145-150`
   - **Sorun:** 
     - `incomingInstant` çağrısının sonucu `SepaBaseResponse<SepaAccountingDto>` olarak alınıyor. Eğer `response` null ise veya `response.getData()` null ise, işlem devam ediyor. Ancak NBS servisi bir hata döndüğünde (örneğin 5xx), `response.getBody()` null olabilir veya içinde hata mesajı olabilir. Kodda bu durum tam kontrol edilmiyor.
     - `incomingReverseAccountingAGI_Test` metodunda `response.getBody()` null kontrolü var ama `response` kendisi null kontrolü yok (satır 145). `serviceLocator.getNbsAdapterClient().incomingInstantReverse(sepaAccountingDto)` null dönebilir.
   - **Neden Important:** Sessizce başarısız olan işlemler, veritabanında "başarılı" olarak işaretlenebilir (eğer save işlemi hata vermezse).
   - **Önerilen kod:**
     ```java
     ResponseEntity<SepaBaseResponse<SepaAccountingDto>> response = serviceLocator
             .getNbsAdapterClient()
             .incomingInstantReverse(sepaAccountingDto);

     if (response == null || response.getBody() == null) {
         log.error("NBS response is null for reverse accounting");
         return new ResponseEntity<>("NBS service error", HttpStatus.INTERNAL_SERVER_ERROR);
     }
     ```

3. **Hardcoded Değerler**
   - **Dosya:** `AccountingController.java:75-77`, `AccountingController.java:133`
   - **Sorun:** `GlAccount`, `NostroAccount`, `GlMaster` değerleri comment olarak hardcoded (örn: `"394010010"`, `"0000030761"`). Bu değerler `dto`'dan geliyor ama comment'ler yanlış yönlendirici olabilir. Ayrıca `userCode` olarak `"SYSTEM-GEN"` hardcoded.
   - **Önerilen kod:**
     ```java
     // Hardcoded değerler yerine constant veya config'den alınmalı
     accounting.setGlAccount(dto.getGlAccount()); 
     // Comment'ler kaldırılmalı veya güncellenmeli
     ```

### 1. Test metinlerinde Türkçe karakter kullanımı
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `void activateDormantAccountStatusUpdate_whenCosmosBodyNull_doesNotThrow()`
- **Açıklama:** JUnit test metot isimlerinde Türkçe karakter (`ü`) kullanılmıştır (`activateDormantAccountStatusUpdate`). Test isimleri İngilizce olmalıdır.
- **Önerilen kod:**
```java
@Test
void activateDormantAccountStatusUpdate_whenCosmosBodyNull_doesNotThrow() {
```

### 2. Test metinlerinde Türkçe karakter kullanımı
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `void doAccountingAfterPositiveResponse_whenFinalSaveFails_returnsOriginalTransaction()`
- **Açıklama:** JUnit test metot isimlerinde Türkçe karakter (`ü`) kullanılmıştır (`doAccountingAfterPositiveResponse`). Test isimleri İngilizce olmalıdır.
- **Önerilen kod:**
```java
@Test
void doAccountingAfterPositiveResponse_whenFinalSaveFails_returnsOriginalTransaction() {
```

### 3. Test metinlerinde Türkçe karakter kullanımı
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `void validAccountClosedValidator_falseForStatus8_trueForStatusA()`
- **Açıklama:** JUnit test metot isimlerinde Türkçe karakter (`ü`) kullanılmıştır (`validAccountClosedValidator`). Test isimleri İngilizce olmalıdır.
- **Önerilen kod:**
```java
@Test
void validAccountClosedValidator_falseForStatus8_trueForStatusA() {
```

1. **Test sınıfı adı yanıltıcı ve sorumluluk dağılımı hatalı**
   - **Dosya:** `AccountServiceImplCoverageBoosterTest.java`
   - **Açıklama:** Sınıf adı `CoverageBoosterTest` olarak belirlenmiş ancak içindeki testler `AccountServiceImpl`'in business logic'ini (request construction, error handling, fallback logic) doğrulamaktadır. "Coverage Booster" genellikle kodun test edilmesini zorlaştıran veya test edilemez kılan kısımların (örneğin statik çağrılar, final sınıflar) mock'lanması için kullanılan, business logic içermeyen, sadece satır sayısını artırmaya yönelik testleri ifade eder. Bu testler aslında `AccountServiceImpl`'in unit testleridir.
   - **Neden Önemli:** Test sınıflarının isimlendirilmesi, testlerin bakımını ve okunabilirliğini doğrudan etkiler. "Coverage Booster" olarak adlandırılan bu testler, gelecekteki geliştiricilerde "business logic testi değil, sadece coverage için yazılmış" algısı yaratarak test kalitesinin düşmesine neden olabilir. Ayrıca, bu testler `AccountServiceImpl`'in davranışını test ettiği için, aslında `AccountServiceImplTest` sınıfında olmalıdır.
   - **Önerilen Kod:**
     ```java
     // Dosya adı ve sınıf adı AccountServiceImplTest olarak değiştirilmeli
     @ExtendWith(MockitoExtension.class)
     class AccountServiceImplTest {
         // ...
     }
     ```

2. **`RuntimeException` kullanımı ve test mantığı**
   - **Dosya:** `AccountServiceImplCoverageBoosterTest.java`, satır 95-100
   - **Açıklama:** `getFindCommission` testinde `RuntimeException` fırlatılması bekleniyor. Ancak, `AccountServiceImpl`'in bu exception'ı yakalayıp `0.0` döndürmesi, `AccountServiceImpl`'in implementasyonuna bağlıdır. Eğer `AccountServiceImpl` bu exception'ı yakalamıyorsa, bu test `AccountServiceImpl`'in davranışını yanlış test ediyor olabilir. Ayrıca, `RuntimeException` yerine daha spesifik bir exception (örn. `ServiceException`) kullanılması daha iyi bir pratiktir.
   - **Neden Önemli:** Test, implementasyon detaylarına çok fazla bağımlı hale geliyor. Eğer `AccountServiceImpl` exception handling stratejisini değiştirirse, bu test yanlışlıkla başarısız olabilir veya yanlış bir davranışı test ediyor olabilir.
   - **Önerilen Kod:**
     ```java
     // AccountServiceImpl'de exception handling yapısına göre test yazılmalı
     // Örneğin, AccountServiceImpl bir custom exception kullanıyorsa:
     when(nbsAdapterClient.getFindCommission(any(FindCommissionRequestDTO.class)))
         .thenThrow(new NbsServiceException("down"));
     ```

1. **Test metotlarında `lenient()` kullanımı ve mock doğrulama eksikliği**
   - **Dosya:** `AccountingExternalServiceComprehensiveTest.java:50-55` (ve diğer test metotları)
   - **Sorun:** Test metotlarında `lenient().when(...)` kullanılarak mock davranışı tanımlanmış ancak `verify()` çağrıları çoğu testte eksik. Özellikle `testConvertAmount_Success_USD_GBP`, `testConvertAmount_Success_TRY_EUR`, `testConvertAmount_WithZeroAmount` gibi testlerde `nbsAdapterClient`'ın doğru parametrelerle çağrıldığı doğrulanmıyor. Bu, servisin dış client'a doğru request'i gönderip göndermediğinin test edilmediği anlamına gelir.
   - **Neden Önemli:** Servisin business logic'ini (parametreleri DTO'ya dönüştürme) test etmiyoruz. Sadece response'un doğru parse edildiğini test ediyoruz.
   - **Önerilen Kod:**
     ```java
     @Test
     void testConvertAmount_Success_USD_GBP() {
         // Arrange
         ExchangeParityConvertResponseDTO responseDTOGBP = new ExchangeParityConvertResponseDTO();
         responseDTOGBP.setAmount(BigDecimal.valueOf(85.00));
         SepaBaseResponse<ExchangeParityConvertResponseDTO> sepaBaseResponseGBP = new SepaBaseResponse<>();
         sepaBaseResponseGBP.setData(responseDTOGBP);

         lenient().when(nbsAdapterClient.convertExchangeParityAmountByRate(any(ExchangeParityByRateConvertRequestDTO.class)))
                 .thenReturn(new ResponseEntity<>(sepaBaseResponseGBP, org.springframework.http.HttpStatus.OK));

         // Act
         BigDecimal result = service.convertAmount(BigDecimal.valueOf(100.00), "USD", "GBP");

         // Assert
         assertNotNull(result);
         assertEquals(BigDecimal.valueOf(85.00), result);
         // EKSİK: Doğru parametrelerle çağrıyı doğrula
         verify(nbsAdapterClient, times(1)).convertExchangeParityAmountByRate(argThat(req ->
             req.getAmount().equals(BigDecimal.valueOf(100.00)) &&
             req.getSourceCurrency().equals("USD") &&
             req.getDestinationCurrency().equals("GBP")
         ));
     }
     ```

2. **`testConvertAmount_ServerError` testinde response body null ve status code 500**
   - **Dosya:** `AccountingExternalServiceComprehensiveTest.java:245-250`
   - **Sorun:** Test, `HttpStatus.INTERNAL_SERVER_ERROR` dönen bir response mockluyor ancak response body'si `null`. Servisin bu durumu nasıl handle ettiğini test etmek için `ResponseEntity`'nin body'sinin null olup olmadığına bakılıyor olabilir, ancak genellikle 5xx hataları için exception fırlatılması veya özel bir error response dönmesi beklenir. Servisin bu senaryoyu nasıl handle ettiğini bilmediğimiz için test yetersiz kalıyor.
   - **Neden Önemli:** Gerçek dünyada 5xx hataları genellikle exception'a dönüşür. Servisin bu durumu doğru handle edip etmediğini test etmiyoruz.
   - **Önerilen Kod:**
     ```java
     @Test
     void testConvertAmount_ServerError() {
         // Arrange
         // Servisin 5xx hatalarında exception fırlattığını varsayıyoruz.
         // Eğer exception fırlatmıyorsa, response body'sinin null olduğunu test etmek yeterli.
         lenient().when(nbsAdapterClient.convertExchangeParityAmountByRate(any(ExchangeParityByRateConvertRequestDTO.class)))
                 .thenThrow(new RuntimeException("Server error")); // Veya ResponseEntity ile null body

         // Act
         BigDecimal result = service.convertAmount(BigDecimal.valueOf(100.00), "EUR", "USD");

         // Assert
         assertNull(result);
     }
     ```

### 1. Import hatası: `respose` vs `response`
- **Dosya:** `AccountingServiceImplAGIAdditionalCoverageTest.java:9`
- **Sorun:** `com.ykb.nl.sepa.dto.respose.ClientDTO` importu yazım hatası içeriyor (`respose`). Bu, `ClientDTO` sınıfının doğru paketinde değilse derleme hatasına veya yanlış bir DTO kullanmasına neden olur.
- **Önerilen kod:**
```java
import com.ykb.nl.sepa.dto.response.ClientDTO; // 'response' olarak düzeltilmeli
```

### 2. Test metodunda `tx()` helper'ı ile `setCRValues` çağrısı arasında tutarsızlık
- **Dosya:** `AccountingServiceImplAGIAdditionalCoverageTest.java:115`
- **Sorun:** `setCRValues` testinde `tx()` metodu çağrılıyor ancak bu metot `IncomingTransactionEntityWR` döndürüyor. `setCRValues` imzası muhtemelen `ClientDTO`, `IncomingTransactionEntityWR`, `SepaAccountingDto`, `BigDecimal`, `FindCommissionResponseDTO` alıyor. Ancak testte `tx()` metodu `IncomingTransactionEntityWR` döndürüyor ve bu doğru görünüyor. Ancak, `setCRValues` metodunun içinde `tx` üzerinden komisyon bilgilerine erişiliyorsa, `tx`'in `commissionAmount` ve `commissionCurrency` alanlarının set edilip edilmediği testte kontrol edilmeli. Bu testte `tx()` metodu bu alanları set etmiyor. Eğer `setCRValues` bu alanlara güveniyorsa test anlamsız olabilir.
- **Önerilen kod:**
```java
@Test
void setCRValues_whenCommissionPositive_setsCrAmounts() {
    SepaAccountingDto accounting = new SepaAccountingDto();
    FindCommissionResponseDTO response = new FindCommissionResponseDTO();
    response.setCommission(3.25);

    IncomingTransactionEntityWR tx = tx();
    tx.setCommissionAmount(new BigDecimal("3.25")); // Komisyon miktarını tx'e de set et
    tx.setCommissionCurrency("EUR"); // Komisyon para birimini de set et

    service.setCRValues(new ClientDTO(), tx, accounting, new BigDecimal("3.25"), response);

    assertEquals(new BigDecimal("3.25"), accounting.getCrAmountOT());
    assertEquals(BigDecimal.ZERO, accounting.getCrAmountTR());
    assertEquals(BigDecimal.ZERO, accounting.getCrAmountNL());
}
```

1. **Test sınıfı adı ile test edilen sınıf arasında tutarsızlık**
   - Dosya: `AccountingServiceImplAGICoverageBoosterTest.java`
   - Sorun: Test sınıfı `AccountingServiceImplAGICoverageBoosterTest` olarak adlandırılmış ancak `@InjectMocks` ile enjekte edilen sınıf `AccountingServiceImplAGI`. Testin adı "CoverageBooster" içeriyor ancak test edilen metotlar (`setConvComAmountForIncomingInstantWR`, `findBaseEquForIncomingInstantWR`) doğrudan `AccountingServiceImplAGI`'nin iş mantığını test ediyor. Bu isimlendirme, testin neyi kapsadığı konusunda (booster mı, ana servis mi?) kafa karışıklığı yaratıyor.
   - Öneri: Test sınıfı adını test ettiği gerçek implementasyon ile eşleştir veya "CoverageBooster" kısmının neden bu sınıfta olduğunu açıklayan bir yorum ekle.
   ```java
   // Öneri: Eğer bu testler sadece AGI servisini test ediyorsa:
   class AccountingServiceImplAGITest { ... }
   ```

2. **`setCommissionFieldsForIncomingInstantWR` testinde `ClientDTO` null kontrolü eksik**
   - Dosya: `AccountingServiceImplAGICoverageBoosterTest.java:85`
   - Sorun: `new com.ykb.nl.sepa.dto.respose.ClientDTO()` ile yeni bir instance oluşturulup metoda geçiliyor. Eğer `AccountingServiceImplAGI.setCommissionFieldsForIncomingInstantWR` metodu bu `ClientDTO` üzerinde null-check yapmıyorsa veya bu DTO'nun iç yapısını (örneğin bir ID veya kod) kullanıyorsa, test gerçek senaryoyu yansıtmayabilir. Ayrıca `respose` paket adı muhtemelen bir typo (`response` olmalı), bu da kod tabanında tutarsızlık yaratır.
   - Öneri: `ClientDTO`'nun gerekli alanlarının set edildiğinden emin olun veya metot içinde kullanılmıyorsa bu parametrenin gereksizliğini doğrulayın.
   ```java
   // Öneri: Paket adını kontrol edin. Eğer typo ise düzeltin.
   // com.ykb.nl.sepa.dto.respose.ClientDTO -> com.ykb.nl.sepa.dto.response.ClientDTO
   ```

1. **Import hatası: `respose` vs `response`**
   - **Dosya:** `AccountingServiceImplAGIFinalCoverageTest.java:9`
   - **Sorun:** `com.ykb.nl.sepa.dto.respose.ClientDTO` importu yazım hatası içeriyor (`respose`). Eğer bu paket adı gerçekten `respose` ise sorun yok, ancak büyük ihtimalle `response` olmalı. Eğer `response` ise bu import derleme hatasına (compile error) neden olur.
   - **Neden Önemli:** Test sınıfı derlenemez.
   - **Öneri:**
     ```java
     // Eğer paket adı response ise:
     import com.ykb.nl.sepa.dto.response.ClientDTO;
     ```

2. **Test metodu isimleri `when...` prefix'i ile karışık**
   - **Dosya:** `AccountingServiceImplAGIFinalCoverageTest.java:43, 55, 68, 82, 96, 118`
   - **Sorun:** Test metotları `when[Condition]_[Action]_[Result]` formatında. Bu JUnit convention'ı (Given-When-Then) için uygundur ancak `when` kelimesi Mockito'nın `when()` metodu ile aynıdır ve okuyucuda kafa karışıklığı yaratabilir. Daha açıklayıcı isimler kullanılmalı.
   - **Neden Önemli:** Kod okunabilirliği ve bakım zorluğu.
   - **Öneri:**
     ```java
     // Örnek:
     // void setConvComAmountForIncomingInstantWR_whenSameNonEurCurrency_returnsZero()
     // -> void setConvComAmountForIncomingInstantWR_withSameNonEurCurrency_shouldReturnZero()
     ```

3. **Mock edilen bağımlılıkların gereksizliği**
   - **Dosya:** `AccountingServiceImplAGIFinalCoverageTest.java:33-41`
   - **Sorun:** `AccountingServiceImplAGI` sınıfının constructor veya field injection ile bağlanan tüm bağımlılıklar mock edilmiş. Ancak test metodlarında sadece birkaç metod çağrılıyor. Örneğin, `setConvComAmountForIncomingInstantWR` testi için `nbsAdapterClient`, `serviceLocator` gibi mocklara gerek yoksa bunlar kaldırılmalı. Bu, testin odak noktasını netleştirir.
   - **Neden Önemli:** Test karmaşıklığı ve gereksiz setup.
   - **Öneri:** Sadece test edilen metodun ihtiyaç duyduğu bağımlılıkları mock et.

1. **Typo in import path: `respose` → `response`**
   - File: `src/test/java/com/ykb/nl/sepa/service/AccountingServiceImplAGIUncoveredLinesTest.java:14`
   - Issue: Import `com.ykb.nl.sepa.dto.respose.ClientDTO` yazım hatası içeriyor. Eğer `ClientDTO` sınıfı gerçekten `respose` paketindeyse bu kabul edilebilir ama büyük ihtimalle `response` olmalı. Eğer `ClientDTO` `response` paketindeyse bu import derleme hatasına yol açar.
   - Why it matters: Derleme hatası veya yanlış sınıf kullanımı.
   - Önerilen kod:
     ```java
     import com.ykb.nl.sepa.dto.response.ClientDTO; // Eğer paket adı response ise
     ```

2. **`assertEquals(null, ...)` kullanımı**
   - File: `src/test/java/com/ykb/nl/sepa/service/AccountingServiceImplAGIUncoveredLinesTest.java:80-81` ve `136-137`
   - Issue: `assertEquals(null, tx.getCommissionExpenseAccountNo())` gibi null kontrolleri `assertNull()` metodu ile yapılmalı. `assertEquals(null, ...)` kullanımı `NullPointerException` riski taşır ve JUnit best practice'lerine aykırıdır.
   - Why it matters: Test kodu kalitesi ve potansiyel runtime hatası.
   - Önerilen kod:
     ```java
     assertNull(tx.getCommissionExpenseAccountNo());
     assertNull(tx.getCommissionExpenseAccountCcy());
     ```

3. **`assertEquals(0.0, ...)` ile `BigDecimal` karşılaştırması**
   - File: `src/test/java/com/ykb/nl/sepa/service/AccountingServiceImplAGIUncoveredLinesTest.java:125`
   - Issue: `assertEquals(0.0, captor.getValue().getCommissionAmount())` satırında `0.0` (double) ile `BigDecimal` karşılaştırılıyor. `SepaAccountingDto.getCommissionAmount()` muhtemelen `BigDecimal` döndürüyorsa, `assertEquals` double ile BigDecimal karşılaştırmada hassasiyet hatası verebilir veya derleme hatası oluşturabilir.
   - Why it matters: Testin yanlış geçmesi veya derleme hatası.
   - Önerilen kod:
     ```java
     assertEquals(BigDecimal.ZERO, captor.getValue().getCommissionAmount());
     ```

### 1. Import Hatası: `respose` vs `response`
- **Dosya:** `AccountingServiceImplComprehensiveTest.java:18`
- **Bulgulama:** `import com.ykb.nl.sepa.dto.respose.ClientDTO;` satırında paket adı `respose` (yanlış yazım) olarak import edilmiş.
- **Neden Önemli:** Bu import, kodun derlenmesini engelleyecektir (`cannot find symbol` hatası). Eğer `ClientDTO` sınıfı gerçekten `response` paketindeyse, bu import düzeltilmeli. Eğer sınıf `respose` paketindeyse, paket isminin düzeltilmesi gerekir.
- **Önerilen kod:**
```java
// Eğer paket adı response ise:
import com.ykb.nl.sepa.dto.response.ClientDTO;
```

### 2. Test Metodunda Assertion Eksikliği
- **Dosya:** `AccountingServiceImplComprehensiveTest.java` (Genel yapı)
- **Bulgulama:** `testOutgoingTransaction_Success` ve `testIncomingAccounting_Success` gibi metodlarda `assertNotNull` dışında, dönen DTO'nun içeriği (örneğin `contractNo`, `accountingStatus`) ile ilgili detaylı assertion'lar eksik veya yetersiz. Özellikle `setCommissionFields` testinde assertion var ama diğerlerinde sadece `verify` var.
- **Neden Önemli:** Servis metodlarının beklenen veriyi doğru şekilde döndüğünü veya işlediğini doğrulamak için assertion'lar şarttır. Sadece `verify` ile metodun çağrıldığını biliyoruz ama çıktının doğru olup olmadığını bilmiyoruz.
- **Önerilen kod:**
```java
// testOutgoingTransaction_Success metodunda:
assertEquals(1L, result.getContractNo());
assertEquals("O", result.getAccountingStatus());
```

### 3. `lenient()` Kullanımının Aşırı Kullanımı ve Mock Tanımlarının Belirsizliği
- **Dosya:** `AccountingServiceImplComprehensiveTest.java`
- **Bulgulama:** `@BeforeEach` içinde birçok `lenient().when(...)` tanımı var. Özellikle `parameterRepository.findByKey` ve `parameterMapper2` için `anyString()` kullanılmış.
- **Neden Önemli:** `lenient()` kullanımı, mock'ların çağrılmadığında hata vermemesini sağlar ancak bu, testin hangi yolların test edildiğini belirsizleştirir. Ayrıca `anyString()` gibi geniş matcher'lar, metodun farklı parametrelerle çağrıldığında aynı davranışı gösterdiğini varsayar ki bu her zaman doğru değildir. Testler daha spesifik olmalı.
- **Önerilen kod:**
```java
// Daha spesifik matcher'lar kullanın veya test metodları içinde mock tanımlarını yapın.
// Örnek:
when(parameterRepository.findByKey("BANK_IBAN")).thenReturn(parameterEntity("BANK_IBAN"));
```

### 1. `AccountingServiceImplTest.java`: Yanlış Assertion Kullanımı ve Test Mantığı Hatası

- **Dosya:** `src/test/java/com/ykb/nl/sepa/service/AccountingServiceImplTest.java:643`
- **Sorun:** Test, `assertions.assertNull(response)` yerine `assertAll(() -> accountingService.outgoingTransaction(dto))` kullanıyor. `assertAll` bir `Runnable` alır ve içindeki işlemlerin exception fırlatıp fırlatmadığını kontrol eder. Ancak `assertAll`'ın içindeki lambda'nın dönüş değeri (`AccountingServiceResponseDTO`) `assertAll` tarafından yok sayılır. Bu değişiklik, metodun `null` döndüğünü doğrulamak yerine, metodun exception fırlatmadığını (void gibi davranmasını) garanti altına alır. Eğer `outgoingTransaction` metodu `null` yerine bir `ResponseEntity` veya başka bir nesne döndürüyorsa bu test hala "geçer" (pass) olur, ancak orijinal testin amacı (response'un null olması) kaybolur. Ayrıca `assertAll`'ın içindeki lambda'nın `void` dönmesi beklenir, burada dönen değer kullanılmadığı için derleyici uyarısı (unused result) verebilir veya mantıksal olarak yanlış bir assertion'a yol açar.
- **Neden Önemli:** Test, yanlış bir şeyi doğruluyor. `null` kontrolü yapılmak isteniyorsa `Assertions.assertNull(response)` doğruydu. `assertAll` genellikle birden fazla assertion'ı gruplamak için kullanılır, tek bir assertion'ın sonucunu yok saymak için değil.
- **Önerilen Kod:**
```java
// Eğer null kontrolü isteniyorsa:
Assertions.assertNull(response);

// Eğer sadece exception fırlatılmadığını kontrol etmek isteniyorsa (ve dönüş değeri önemli değilse):
assertDoesNotThrow(() -> accountingService.outgoingTransaction(dto));
```

### 2. `OutgoingTransactionIntbankServiceAdditionalCoverageTest.java`: Eksik Mock Tanımları ve Constructor Bağımlılıkları

- **Dosya:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionIntbankServiceAdditionalCoverageTest.java:40-58`
- **Sorun:** Test sınıfında çok sayıda `@Mock` tanımlanmış ancak `OutgoingTransactionIntbankService` constructor'ına geçirilen bağımlılıkların hepsi mock olarak sağlanıyor. Ancak, `OutgoingTransactionIntbankService`'in constructor imzası ile testteki constructor çağrısı arasındaki bağımlılık sırası veya tipi eşleşmiyorsa (örneğin, `SimpleMeterRegistry` yerine başka bir metrik registry bekleniyorsa veya bağımlılık sırası değiştiyse) test derlenmez veya runtime hatası verir. Ayrıca, `OutgoingTransactionIntbankService` içinde kullanılan bazı servisler (örneğin `accountingService`) mock olarak verilmiş ama bu mock'ların davranışı (`doNothing`, `when().thenReturn`) test senaryosuna göre doğru şekilde yapılandırılmamış olabilir. Özellikle `processAccounting` metodu içinde `accountingService.doAccountingInsantIntbank(outgoing)` çağrısı `never()` olarak doğrulanıyor. Bu, `processAccounting` metodunun iç mantığına bağlıdır. Eğer `processAccounting` metodu içinde başka bir koşul (örneğin `valueDate` kontrolü) başarısız olursa veya başka bir servis çağrısı yapılırsa ve bu servis mock değilse, test hata verir.
- **Neden Önemli:** Test, bağımlılıkların doğru yapılandırılmasına bağlıdır. Eksik veya yanlış mock yapılandırması, testin yanlış sonuç vermesine (false positive/negative) veya çalışmamasına neden olabilir.
- **Önerilen Kod:**
```java
// Test sınıfındaki constructor çağrısının, gerçek service constructor imzasıyla birebir eşleştiğinden emin olun.
// Ayrıca, processAccounting metodunun iç mantığını kontrol edin ve gerekli mock davranışlarını ekleyin.
// Örnek:
// when(accountingService.doAccountingInsantIntbank(any())).thenReturn(...); // Eğer bu çağrı bekleniyorsa
// veya
// verify(accountingService, never()).doAccountingInsantIntbank(any()); // Eğer bu çağrı beklenmiyorsa (şu anki durum)
```

### 1. Testlerde `RuntimeException` kullanımı ve assertion eksikliği
`OutgoingTransactionMapperServiceTest` dosyasında, özellikle `insertCommissionDetails_keepsFieldsNull_whenAccountServiceThrows` testinde, `accountService.getAccountList` çağrısı `RuntimeException` fırlatıyor. Test, bu durumun işlevin `entity` üzerindeki komisyon alanlarını `null` bırakıp bırakmadığını kontrol ediyor. Ancak, testin amacı "hata durumunda güvenli davranış" ise, `RuntimeException` yerine domain'e özgü bir exception (örneğin `AccountNotFoundException` veya `ExternalServiceException`) kullanılması daha iyidir. Ayrıca, `getOutgoingTransactionDTO_mapsNullWhenNotFound` testinde, `outgoingTransactionMapper.toOutgoingTransactionDTO((OutgoingTransactionEntity) null)` çağrısı yapılıyor. Bu, mapper'in `null` input'u nasıl handle ettiğini test etmiyor; sadece mock'un `null` parametreyle çağrıldığında ne döndüğünü doğruluyor. Gerçek senaryoda repository `Optional.empty()` döndüğünde, service katmanı mapper'i `null` ile çağırmamalıdır (veya null-check yapmalıdır). Eğer service katmanı `null` ile mapper çağırıyorsa, bu bir **bug** olabilir.

**Önerilen kod:**
```java
// Service katmanında null kontrolü yoksa ve mapper null kabul ediyorsa:
// OutgoingTransactionDTO result = entity != null ? mapper.toOutgoingTransactionDTO(entity) : new OutgoingTransactionDTO();
// Bu davranışın testte açıkça belirtilmesi veya service'in null-check yapması beklenir.
```

### 2. `OutgoingTransactionProxyServiceCoverageTest`'te `thenAnswer` kullanımı ve `saveOutgoingTransactionMaster`
`process_whenNbsInactive_andCommissionLookupThrows_stillSavesTransaction` testinde, `outgoingTransactionService.saveOutgoingTransactionMaster` metodu `thenAnswer` ile mock'lanmış ve argument olarak geçen DTO'yu geri döndürüyor. Bu, `save` metodunun dönüş tipinin `OutgoingTransactionDTO` olduğunu varsayar. Eğer `save` metodu `void` veya farklı bir tip döndürüyorsa bu mock yanlış kurulur. Ayrıca, test adı "stillSavesTransaction" olsa da, `saveOutgoingTransactionMaster` çağrısının gerçekten DB'ye yazılıp yazılmadığı (veya en azından çağrıldığı) `verify` ile kontrol edilmiyor. Sadece dönüş değeri kontrol ediliyor.

**Önerilen kod:**
```java
// Testin sonunda save metodunun çağrıldığı doğrulanmalı:
verify(outgoingTransactionService).saveOutgoingTransactionMaster(any(OutgoingTransactionDTO.class));
```

1. **Test sınıfında typo: `respose` paket adı**
   - **Dosya:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionProxyServiceNewCoverageTest.java:3`
   - **Sorun:** `import com.ykb.nl.sepa.dto.respose.ClientDTO;` satırında `response` yerine `respose` yazılmış. Bu, muhtemelen `ClientDTO`'nun bulunduğu paketin ismindeki bir typo'dur. Eğer paket adı gerçekten `respose` ise bu kabul edilebilir bir isimlendirme hatasıdır; ancak eğer `response` olması gerekiyorsa bu import derleme hatasına veya yanlış sınıfı import etmeye neden olur.
   - **Öneri:** Paket adının `respose` mi yoksa `response` mı olduğunu doğrula. Eğer `response` ise import'u düzelt:
     ```java
     import com.ykb.nl.sepa.dto.response.ClientDTO;
     ```

2. **`NullPointerException` testi, kodun gerçek davranışını test etmiyor olabilir**
   - **Dosya:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionProxyServiceNewCoverageTest.java:45-52` ve `54-61`
   - **Sorun:** `validate` ve `process` metodlarında `NbsAdapterClient`'ın `null` döndüğü durumlar için `NullPointerException` bekleniyor. Ancak, bu testler `service.validate()` ve `service.process()` metodlarının `null` döndüğünde açıkça `NullPointerException` fırlattığını varsayıyor. Eğer `OutgoingTransactionProxyService` bu durumu daha iyi bir exception ile (örneğin `IllegalArgumentException` veya özel bir exception) veya `null` yerine boş bir liste ile ele alıyorsa, bu testler yanlış pozitif verecektir. Ayrıca, `NullPointerException` genellikle bir bug'dır ve test edilmemesi gereken bir durumdur; bunun yerine `null` girişi için geçerli bir hata mesajı veya exception beklenmelidir.
   - **Öneri:** `OutgoingTransactionProxyService`'in `null` response durumunda nasıl davrandığını kontrol et. Eğer `NullPointerException` fırlatıyorsa, bu bir bug'dır ve düzeltilmelidir. Eğer başka bir exception fırlatıyorsa, test'i buna göre güncelle.
     ```java
     // Örnek: Eğer IllegalArgumentException bekleniyorsa
     assertThrows(IllegalArgumentException.class, () -> service.validate(model));
     ```

3. **`Spy` kullanımı ve `OutgoingTransactionMapper`**
   - **Dosya:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionProxyServiceNewCoverageTest.java:35`
   - **Sorun:** `@Spy private OutgoingTransactionMapper outgoingTransactionMapper = new OutgoingTransactionMapperImpl();` satırında `Spy` kullanılmış. `Spy` objeleri, mock edilen metodlar hariç gerçek implementasyonu çalıştırır. `OutgoingTransactionMapperImpl`'in gerçek implementasyonu, test sırasında istenmeyen yan etkiler yaratabilir (örneğin, veritabanı erişimi, ağ çağrıları vb.). Bu, testi daha kırılgan ve yavaş yapar.
   - **Öneri:** Eğer `OutgoingTransactionMapper`'in gerçek implementasyonu güvenliyse ve test için gerekliyse `Spy` kullanılabilir, ancak genellikle `@Mock` veya `@InjectMocks` ile mock etmek daha iyidir. Eğer `Spy` kullanımı gerekiyorsa, mapper'in gerçek implementasyonunun test ortamında güvenli olduğundan emin ol.
     ```java
     // Daha güvenli yaklaşım: Mock kullan
     @Mock private OutgoingTransactionMapper outgoingTransactionMapper;
     ```

### 1. Test Class Naming Convention
- **File:** `OutgoingTransactionServiceImplCoverageBoosterTest.java`
- **Issue:** Class name `CoverageBoosterTest` is misleading. It implies the purpose is to boost code coverage metrics rather than testing business logic. This naming convention can be confusing for other developers and does not reflect the actual content (unit tests for specific methods).
- **Why it matters:** Misleading names reduce codebase maintainability. If the goal is coverage, the class should be named after the service or functionality it tests (e.g., `OutgoingTransactionServiceImplTest`).
- **Önerilen kod:**
```java
// Rename file and class to:
class OutgoingTransactionServiceImplTest {
    // ...
}
```

### 2. Missing Assertions for Service Logic
- **File:** `OutgoingTransactionServiceImplCoverageBoosterTest.java`
- **Issue:** The test `createOutgoingMessageDocs_setsSummaryFields` only verifies the return value's fields but does not verify that the service actually created entities in the repository or persisted them. It mocks `sepaIdGeneration` but doesn't verify interactions with `outgoingTransactionPersistenceService` or `repositoryLocator`.
- **Why it matters:** This test passes even if the service method is empty (as long as it returns a mock object with those fields). It doesn't verify the actual business logic of creating and saving the transaction.
- **Önerilen kod:**
```java
@Test
void createOutgoingMessageDocs_setsSummaryFields() {
    // ... setup ...
    
    OutgoingMessageDocsCTPIDTO result = service.createOutgoingMessageDocs(List.of(item));

    // Verify persistence service was called
    verify(outgoingTransactionPersistenceService).save(any(OutgoingTransactionEntity.class));
    
    // ... existing assertions ...
}
```

### 3. Inconsistent Mocking Strategy
- **File:** `OutgoingTransactionServiceImplCoverageBoosterTest.java`
- **Issue:** Some tests use `@InjectMocks` which automatically injects mocks, but the test `updateOutgoingTransactionStatusById` manually creates `OutgoingTransactionEntityWR` and sets up mocks for `outgoingTransactionServiceWR`. However, `outgoingTransactionServiceWR` is a mock, so the test is only verifying that the mock returns what it was set to return, not the actual service logic.
- **Why it matters:** This is a "mocking trap" where tests verify mock behavior rather than service behavior. If the service logic changes (e.g., adds validation before calling the WR service), this test won't catch it.
- **Önerilen kod:**
```java
// Consider adding verification of service method calls
@Test
void updateOutgoingTransactionStatusById_delegatesToWrService() {
    // ... setup ...
    
    OutgoingTransactionEntityWR result = service.updateOutgoingTransactionStatusById(9L, "APPROVED");

    assertEquals(9L, result.getId());
    // Verify the service method was called with correct arguments
    verify(outgoingTransactionServiceWR).update(eq(9L), eq("APPROVED"), any());
}
```

#### 1. Import hatası: `respose` vs `response`
- **File:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionServiceImplCoverageGapsTest.java:8`
- **Issue:** `ClientDTO` import'u `com.ykb.nl.sepa.dto.respose.ClientDTO` şeklinde yazılmış. Muhtemelen `response` kelimesinin yazım hatası (`respose`). Bu import derleme hatasına (compilation error) neden olur.
- **Why it matters:** Test sınıfı derlenemez, PR merge edilemez.
- **How to fix:** Import'u doğru paket yoluna düzeltin.

**Önerilen kod**
```java
// Doğru paket yolunu kontrol edin, muhtemelen 'response' olmalı
import com.ykb.nl.sepa.dto.response.ClientDTO;
```

#### 2. Test mantığı hatası: `updateInquiryClientInfo` testinde beklenti
- **File:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionServiceImplCoverageGapsTest.java:115-119`
- **Issue:** Test, `dto.setDebtorClientNo(null)` yapıldığında `dto.getJointType()`'in `null` kalmasını bekliyor. Ancak `updateInquiryClientInfo` metodunun ne yaptığına dair bağlam yoksa da, bu test genellikle "null check" yapıldığını doğrulamak için yazılır. Eğer metod içinde `jointType` set ediliyorsa bu test fail olur. Eğer set edilmiyorsa `null` assertion'ı doğrudur. Ancak daha kritik olan nokta: Test adı `doesNothing` ama assertion `getJointType()` üzerinde. Metodun `jointType` dışında başka bir şey yapmadığını veya `jointType`'i etkilemediğini doğruluyor. Bu testin değeri düşük olabilir ama **derleme hatası** kadar kritik değil.
- **Why it matters:** Testin amacının net olması gerekir. Eğer `jointType` set ediliyorsa test yanlış.
- **How to fix:** Metodun gerçek davranışına göre assertion'ı güncelleyin veya test metodunu silin.

**Önerilen kod**
```java
// Eğer metod jointType'ı null yapıyorsa:
assertEquals(null, dto.getJointType());

// Eğer metod jointType'ı değiştirmiyorsa ve başlangıçta null değilse:
// assertEquals(expectedJointType, dto.getJointType());
```

1. **Test sınıflarında gereksiz Mock bağımlılıkları**
   - **Dosya:** `OutgoingTransactionServiceImplUncoveredLinesTest.java`
   - **Açıklama:** Test sınıfında 30'dan fazla `@Mock` field tanımlanmış ancak test metodlarında yalnızca 4-5 tanesi kullanılıyor. `@InjectMocks` ile `OutgoingTransactionServiceImpl` instance'ı oluşturulurken, mock'lanmayan bağımlılıklar (örneğin `accountingService`, `accountService`, `userService` vb.) gerçek instance olarak enjekte edilmeye çalışılır veya null bırakılır. Eğer `OutgoingTransactionServiceImpl` bu bağımlılıkları constructor'da alıyorsa ve null kabul etmiyorsa, testler `NullPointerException` ile başarısız olur. Eğer null kabul ediyorsa, bu testlerin amacı "uncovered lines"ı artırmaksa, bu mock'lar gereksiz yere yer kaplıyor ve sınıfın gerçek bağımlılık yapısını yansıtmıyor.
   - **Öneri:** Sadece test metodlarında kullanılan mock'ları tut. Kullanılmayan mock'ları sil veya `@Mock` yerine `@Spy` veya gerçek instance kullan (eğer test mantığı bunu gerektiriyorsa).
   ```java
   // Kullanılmayan mock'ları sil
   // @Mock private AccountingService accountingService; // Kullanılmıyor
   // @Mock private AccountService accountService; // Kullanılmıyor
   ```

2. **Test metodlarında `when` bloklarının tekrar eden yapısı**
   - **Dosya:** `OutgoingTransactionServiceImplUncoveredLinesTest.java`
   - **Açıklama:** `getOutgoingTransactionsByWorkflowReferenceId` testlerinde `repositoryLocator` mock'ı her test metodunda ayrı ayrı set ediliyor. Bu, test kodunu tekrar eden ve okunabilirliğini azaltan bir yapı. `@BeforeEach` veya `@BeforeAll` kullanılarak ortak setup'lar merkezileştirilebilir.
   - **Öneri:** Ortak mock setup'larını `@BeforeEach` metodunda topla.
   ```java
   @BeforeEach
   void setUp() {
       when(repositoryLocator.getOutgoingTransactionMasterRepository()).thenReturn(outgoingTransactionMasterRepository);
       when(repositoryLocator.getOutgoingTransactionRepository()).thenReturn(outgoingTransactionRepository);
   }
   ```

### 1. Test Dosyasında Gereksiz ve Dağınık Mock Kurulumu
- **File:** `OutgoingTransactionActionServiceCoverageGapsTest.java:76-78`
- **Issue:** `handleDeductFromPayment` test metodunda `OutgoingTransactionRepository` manuel olarak `mock()` ile oluşturulup `repositoryLocator`'a set ediliyor. Bu, testin okunabilirliğini bozar ve `@Mock` anotasyonuyla yönetilmesi gereken bir bağı manuel müdahale ile kurmayı gerektirir. Ayrıca `repositoryLocator.getOutgoingTransactionRepository()` çağrısının mocklanması, testin amacından (komisyon mantığı) ziyade infrastructure kurulumuna odaklanıyor.
- **Why it matters:** Test bakımı zorlaşır, Mockito'nun otomatik injection yeteneği kullanılmamış olur.
- **Önerilen kod:**
```java
// RepositoryLocator zaten @Mock olduğu için, repositoryLocator.getOutgoingTransactionRepository()
// çağrısının ne döndüğünü mocklamak yerine, repositoryLocator'ın davranışını
// test metodunun başında veya setup'ında netleştir. Ancak en temizi:
// repositoryLocator'ın getOutgoingTransactionRepository() metodunun return değerini
// test metodunun içinde daha temiz bir şekilde mocklamak veya @Mock olan repositoryLocator'ı
// kullanırken Mockito.when(repositoryLocator.getOutgoingTransactionRepository()).thenReturn(...)
// şeklinde daha standart bir mock kullanımı.
// Mevcut kod:
com.ykb.nl.sepa.dao.repository.OutgoingTransactionRepository repository =
        org.mockito.Mockito.mock(com.ykb.nl.sepa.dao.repository.OutgoingTransactionRepository.class);
when(repositoryLocator.getOutgoingTransactionRepository()).thenReturn(repository);

// Önerilen: Eğer repository'ye ayrıca mocklama yapılacaksa bu şekilde kalabilir ama
// değişken ataması ve mock çağrısı daha temiz bir yapıda olabilir.
// Alternatif: repositoryLocator'ın davranışını test öncesi setup'ta belirle.
```

### 2. `OutgoingTransactionActionServiceOthersTest.java` Dosyasında Eksik Mock ve Potansiyel NullPointer
- **File:** `OutgoingTransactionActionServiceOthersTest.java:100-102`
- **Issue:** `OutgoingTransactionMapperService` mock olarak eklendi ancak `OutgoingTransactionActionService` içinde bu servisin nasıl kullanıldığına dair test senaryoları (örneğin `submitTransaction` veya `saveAndCloseTransaction` gibi metodlar) bu mock'u kullanacak şekilde ayarlanmamış olabilir. Eğer `OutgoingTransactionActionService` bu servisi kullanıyorsa ve testlerde `when(...).thenReturn(...)` ile davranışı tanımlanmadıysa, gerçek bir instance çağrısı veya null pointer riski doğabilir. Özellikle `OutgoingTransactionMapperService`'in `OutgoingTransactionActionService`'e inject edildiği ve bu servisin başka servisleri (örn. `OutgoingTransactionMapper`) kullandığı düşünülürse, zincirleme mocklama gerekebilir.
- **Why it matters:** Testler pass olsa bile, runtime'da `OutgoingTransactionMapperService` içindeki bağımlılıklar (örn. `OutgoingTransactionMapper`) mocklanmadıysa `NullPointerException` veya beklenmeyen davranışlar oluşabilir.
- **Önerilen kod:**
```java
// OutgoingTransactionMapperService'in davranışını test metodlarında netleştirin.
// Örneğin:
when(outgoingTransactionMapperService.someMethod(any())).thenReturn(expectedResult);
```

### 1. Test Assertion'ı Kaldırıldı, Assertion Yok
- **File:** `src/test/java/com/ykb/nl/sepa/util/CustomDateJsonDeserializerForNostroTest.java:36`
- **Issue:** `CustomDateJsonDeserializerForNostroTest` sınıfında `givenValidDate_whenDeserialize_thenReturnsExpectedDate` test metodu, diff ile birlikte `assertNotNull` ve `assertEquals` (date format doğrulaması) satırlarını kaybetti. Yerine `assertAll(() -> deserializer.deserialize(jsonParser, null));` yazılmış. Bu satır bir assertion içermiyor, sadece metodu çağırıyor. Test artık "pass" ediyor ama date parsing mantığını doğrulamıyor.
- **Why it matters:** Test coverage düşüyor ve date formatlama bug'ı tespit edilemiyor.
- **Önerilen kod:**
```java
Date result = deserializer.deserialize(jsonParser, null);
assertNotNull(result);
SimpleDateFormat sdf = new SimpleDateFormat("dd-MM-yyyy");
Date expected = sdf.parse(dateString);
assertEquals(expected.getTime(), result.getTime());
```

### 2. Gereksiz Import Silinmemiş (Context Check)
- **File:** `src/test/java/com/ykb/nl/sepa/util/CustomDateJsonDeserializerForNostroTest.java`
- **Issue:** Diff'te `import java.text.SimpleDateFormat;` satırı silinmiş (`-`). Ancak dosyanın geri kalanında (File context) bu import'un başka bir yerde kullanıldığını göremiyoruz. Ancak test metodunda `SimpleDateFormat` kullanımı kaldırıldığı için import'un silinmesi doğru. Bu bir bug değil, diff'in doğru uygulandığını gösterir. Ancak `CustomDateJsonDeserializerForNostroTest.java` dosyasının tamamında bu import'un kullanılmadığından emin olunmalı.
- **Why it matters:** Eğer başka bir yerde kullanılıyorsa build hatası alabilir. Context'te başka kullanım yok gibi görünüyor.
- **Önerilen kod:**
```java
// Import silindi, doğru.
```

1. **Test method isimleri `_Test` suffix'i ile bitiyor**
   - Dosya: `AccountingControllerComprehensiveTest.java`
   - Satır: `incomingAccountingAGI_Test`, `incomingReverseAccountingAGI_Test`
   - Sorun: JUnit test metotları `_Test` suffix'i ile bitmemeli. Bu suffix, test metodunun kendisi değil, controller'daki test amaçlı expose edilmiş metodun adıdır. Test metodu isimleri `testIncomingAccountingAGI` gibi olmalı.
   - Neden önemli: Test runner'lar ve IDE'ler bu suffix'i yanlış yorumlayabilir; ayrıca kod standardına aykırı.
   - Öneri:
   ```java
   @Test
   void testIncomingAccountingAGI() {
       // ...
       ResponseEntity<String> result = controller.incomingAccountingAGI(dto);
       // ...
   }
   ```

2. **`lenient()` kullanımı gereksiz yere yaygın**
   - Dosya: `AccountingControllerComprehensiveTest.java`
   - Satır: Tüm `lenient().when(...)` çağrıları
   - Sorun: `lenient()` sadece bir mock'un birden fazla kez çağrılmasının veya beklenmedik bir çağrının yapıldığı durumlarda `MockitoException` fırlatmasını engellemek için kullanılır. Burada her mock çağrısı test senaryosunun bir parçası olarak bekleniyorsa `lenient()` gereksizdir ve testin niyetini bulanıklaştırır.
   - Neden önemli: Testler daha okunabilir ve niyetleri net olmalı. `lenient()`'in yanlış kullanımı, testlerin aslında neyi doğruladığını gizleyebilir.
   - Öneri:
   ```java
   // Gereksiz lenient kaldırılmalı
   when(repositoryLocator.getIncomingTransactionWithoutRelationRepository())
           .thenReturn(incomingTransactionRepositoryWR);
   ```

3. **Test senaryolarında `errorMessage` kontrolü eksik**
   - Dosya: `AccountingControllerComprehensiveTest.java`
   - Satır: `testIncomingAccountingAGI_WithErrorResponse`, `testIncomingReverseAccountingAGI_WithErrorResponse`
   - Sorun: `SepaAccountingDto`'ya `errorMessage` set edilmiş ancak test assertion'larında bu error message'ın controller tarafından nasıl işlendiği (örneğin, loglama, farklı bir HTTP status code dönme, veya exception fırlatma) kontrol edilmiyor. Sadece `HttpStatus.OK` ve `"OK"` response'u kontrol ediliyor.
   - Neden önemli: Error handling mantığının doğru çalıştığını doğrulamak için error message'ın işlenişini test etmek gerekir.
   - Öneri:
   ```java
   // Assert kısmına error handling kontrolü eklenmeli
   // Örnek: controller.errorLogContains("Accounting Error") veya benzeri bir kontrol
   ```

1. **Test metotlarında `_Test` suffix'i ve `@Test` kullanımı**
   - **Dosya:** `AccountingControllerCoverageGapsTest.java:59` ve `AccountingControllerCoverageGapsTest.java:82`
   - **Sorun:** `controller.incomingAccountingAGI_Test(dto)` ve `controller.incomingReverseAccountingAGI_Test(dto)` çağrıları yapılıyor. Bu, `AccountingController` sınıfında bu isimde public metotların var olduğunu veya reflection/mock ile erişildiğini ima eder. Eğer bu metotlar gerçekten `AccountingController` içinde `_Test` suffix'i ile tanımlanmışsa, bu production kodda test metotlarının kalmasına neden olur. Eğer bu metotlar yoksa ve testler compile olmuyorsa, testler çalışmaz.
   - **Neden Önemli:** Production kodunda test metotlarının bulunması kirlilik yaratır ve yanlışlıkla çağrılabilir. Ayrıca, eğer bu metotlar yoksa testler derlenmez.
   - **Önerilen kod:**
     ```java
     // Eğer controller'da bu metotlar yoksa, testler ilgili production metotları (örneğin incomingAccountingAGI) çağırmalıdır.
     // Eğer bu metotlar sadece test amaçlı eklenmişse, production kodundan silinmeli veya @Test ile işaretlenmemeli.
     ResponseEntity<String> response = controller.incomingAccountingAGI(dto);
     ```

2. **Mock edilen repository'lerin doğru konfigürasyonu**
   - **Dosya:** `AccountingControllerCoverageGapsTest.java:46-48` ve `AccountingControllerCoverageGapsTest.java:73-75`
   - **Sorun:** `repositoryLocator.getIncomingTransactionWithoutRelationRepository()` ve `repositoryLocator.getIncomingTransactionRepository()` mock'ları doğru şekilde yapılmış. Ancak, `IncomingTransactionRepository` ve `IncomingTransactionRepositoryWR` interface'lerinin doğru şekilde mock edildiğinden emin olunmalı. Eğer bu interface'ler farklı implementasyonlara sahipse, mock'lar yanlış olabilir.
   - **Neden Önemli:** Yanlış mock konfigürasyonu, testlerin gerçek davranışı yansıtmamasına neden olur.
   - **Önerilen kod:**
     ```java
     // Repository interface'lerinin doğru şekilde mock edildiğinden emin olun.
     // Örneğin, IncomingTransactionRepositoryWR interface'i doğru şekilde mock edilmeli.
     when(repositoryLocator.getIncomingTransactionWithoutRelationRepository()).thenReturn(incomingTransactionRepositoryWR);
     ```

## Minor
### OutgoingTransactionEntity ve WR Sınıfında Duplikasyon
- **File:** `src/main/java/com/ykb/nl/sepa/dao/entity/OutgoingTransactionEntity.java`, `OutgoingTransactionEntityWR.java`
- **Issue:** Her iki sınıfa da aynı 5 alan (`localAmount`, `calculatedCommissionAmount`, vb.) eklenmiş. `EntityWR` (Write/Read?) sınıfı genellikle bir subset veya özel bir mapping için kullanılır. Bu alanların her iki sınıfta da tutulması, veri tutarlılığı (consistency) açısından manuel senkronizasyon gerektirir.
- **Why it matters:** Bir sınıfta değişiklik yapılıp diğerinde unutulursa mapping hataları oluşur.
- **How to fix:** `EntityWR` sınıfının gerçekten bu alanlara ihtiyacı var mı? Eğer evet, bu durumun dokümante edilmesi veya ortak bir base class/interface ile yönetilmesi önerilir.

### ExchangeParityConvertRequestDTO Import Sırası
- **File:** `src/main/java/com/ykb/nl/sepa/dto/ExchangeParityConvertRequestDTO.java`
- **Issue:** `java.math.BigDecimal` ve `java.util.Date` importları sınıf tanımından sonra eklenmiş, ancak dosya başındaki `package` ve `lombok` importlarından sonra. Standart import sıralaması (statik, java, javax, diğer) bozulmamış olsa da, yeni eklenen java.util importları dosyanın yapısını biraz dağıtmış.
- **Why it matters:** Style nitpick.
- **How to fix:** Importları gruplandırarak düzenleyin.

### 1. `AccountingControllerDTO`'da gereksiz boşluklar
**File:** `AccountingControllerDTO.java`
**Issue:** Dosyanın sonunda gereksiz boş satırlar var.
**Önerilen kod:**
```java
// Dosyanın sonundaki gereksiz boş satırları sil.
```

### 2. `OutgoingTransactionDTO`'da `toString()` metodu güncellenmemiş
**File:** `OutgoingTransactionDTO.java`
**Issue:** Yeni eklenen `localAmount`, `calculatedCommissionAmount` gibi alanlar `toString()` metoduna dahil edilmemiş. Debugging sırasında bu alanların loglarda görünmemesi sorun tespiti zorlaştırabilir.
**Önerilen kod:**
```java
@Override
public String toString() {
    return "OutgoingTransactionDTO{" +
            "id=" + id +
            ", clientFullName='" + clientFullName + '\'' +
            ", amount=" + amount +
            ", localAmount=" + localAmount + // Yeni alan eklendi
            ", calculatedCommissionAmount=" + calculatedCommissionAmount + // Yeni alan eklendi
            ", currency='" + currency + '\'' +
            ", transactionStatus='" + transactionStatus + '\'' +
            '}';
}
```

### 3. `AccountingServiceRequestDTO`'da `Double` kullanımı
**File:** `AccountingServiceRequestDTO.java`
**Issue:** `amount`, `commissionAmount`, `chargeAmount` alanları `Double` olarak tanımlanmış. Bankacılık işlemlerinde `BigDecimal` kullanılması precision kaybını önlemek için önemlidir. Bu PR'da diğer DTO'larda `BigDecimal` kullanımı yaygınlaştırılmışken, bu DTO'da `Double` bırakılmış.
**Önerilen kod:**
```java
import java.math.BigDecimal;

// ...
private BigDecimal amount;
private BigDecimal commissionAmount;
private BigDecimal chargeAmount;
```

### 1. `AccountServiceImpl`'de `getAccountList` metodunun `@Override` annotation'ı eksikliği
- **File:** `src/main/java/com/ykb/nl/sepa/service/AccountServiceImpl.java`
- **Issue:** `getAccountList` metodu `AccountService` interface'inde tanımlanmış ancak `AccountServiceImpl`'deki implementasyonunda `@Override` annotation'ı eksik.
- **Why it matters:** Kod okunabilirliği ve refactoring sırasında hata yapma riski.
- **Önerilen kod:**
```java
@Override
public ResponseEntity<SepaBaseResponse<List<AccountResponseDTO>>> getAccountList(Long clientNo) {
    // ...
}
```

### 2. `SepaAccountingDto`'da `BigDecimal` alanlarının default değerleri
- **File:** `src/main/java/com/ykb/nl/sepa/external/dto/sepa/SepaAccountingDto.java`
- **Issue:** `SepaAccountingDto`'ya eklenen `BigDecimal` alanları (`fccaBaseEqu`, `convComAmount`, `crAmountNL`, `crAmountTR`, `crAmountOT`) `null` olabilir. Bu alanların `null` kontrolü yapılmadan kullanılması `NullPointerException` veya yanlış hesaplama riski taşır.
- **Why it matters:** Runtime error veya yanlış hesaplama.
- **Önerilen kod:**
```java
// Bu alanları kullanan yerlerde null kontrolü yapın.
// Örnek:
BigDecimal fccaBaseEqu = sepAccountingDto.getFccaBaseEqu() != null ? sepAccountingDto.getFccaBaseEqu() : BigDecimal.ZERO;
```

1. **`Optional` kullanımı ve okunabilirlik**
   - **Dosya:** `AccountingExternalService.java:31-33`
   - **Sorun:** `Optional.ofNullable(...).orElseThrow().getData()` zinciri ve ardından gelen `Optional.ofNullable(...).map(...).orElse(null)` ifadesi okunabilirliği düşürüyor ve gereksiz nesne oluşturmaya yol açıyor.
   - **Öneri:** Daha basit null kontrolleri veya `orElseThrow` ile netleştirme.

    ```java
    var response = nbsAdapterClient.convertExchangeParityAmountByRate(request).getBody();
    if (response == null || response.getData() == null) {
        throw new IllegalStateException("Exchange parity response is null");
    }
    return response.getData().getAmount();
    ```

2. **`Date` kullanımı**
   - **Dosya:** `AccountingExternalService.java:28`
   - **Sorun:** `new Date()` kullanımı deprecated değilse bile, modern Java'da `java.time` paketi tercih edilmelidir.
   - **Öneri:** `LocalDate.now()` kullanımı daha uygun olabilir (eğer DTO bunu destekliyorsa).

    ```java
    // request.setExchangeDate(new Date());
    // request.setExchangeDate(LocalDate.now()); // DTO destekliyorsa
    ```

1. **Loglama tutarlılığı**
   - **Dosya:** `AccountingServiceImpl.java:113` ve `119`
   - **Sorun:** `log.info("AccountingServiceImpl Request: {}", ...)` ve `log.info("AccountingServiceImpl response: {}", ...)` logları, `setCommissionFields` çağrısından önce ve sonra yapılıyor. Ancak, `setCommissionFields` içinde de loglama yapılıyor. Bu, logların karışık olmasına neden olabilir.
   - **Önerilen Kod:**
     ```java
     // Loglama tutarlılığı sağlanmalı. Örneğin, request ve response logları,
     // setCommissionFields çağrısından önce ve sonra değil,
     // request ve response nesneleri tam olarak hazır olduktan sonra yapılmalı.
     ```

2. **`setCommissionFieldsForReverseAccounting` metodunda `null` kontrolü**
   - **Dosya:** `AccountingServiceImpl.java:250-251`
   - **Sorun:** `sepaAccountingDto.setFccaBaseEqu(outgoingTransaction.getLocalAmount() != null ? outgoingTransaction.getLocalAmount() : null);` satırında, `outgoingTransaction.getLocalAmount()` null ise `null` set ediliyor. Bu, `StringUtil.nvl` kullanımıyla daha temiz yapılabilir.
   - **Önerilen Kod:**
     ```java
     sepaAccountingDto.setFccaBaseEqu(StringUtil.nvl(outgoingTransaction.getLocalAmount(), null));
     ```

### 1. Gereksiz `try-catch` blokları
- **Dosya:** `AccountingServiceImplAGI.java`
- **Satır:** `setCrAmounts`, `handleCalcCommissionResponse`
- **Açıklama:** Bu metodlar çok basit işlemler yapıyor ve exception durumunda sadece loglama yapıp sessizce geçiyor. Bu tür durumlarda exception'ın üst katmana fırlatılması veya daha anlamlı bir hata yönetimi tercih edilebilir. Ayrıca, `setCrAmounts` metodundaki `try-catch` gereksizdir çünkü `BigDecimal` set işlemleri NPE hariç exception fırlatmaz.
- **Önerilen kod:**
```java
    public void setCrAmounts(SepaAccountingDto accountingDto, BigDecimal amount) {
        if (Objects.isNull(amount)) {
            amount = BigDecimal.ZERO;
        }
        accountingDto.setCrAmountOT(amount);
        accountingDto.setCrAmountTR(BigDecimal.ZERO);
        accountingDto.setCrAmountNL(BigDecimal.ZERO);
    }
```

### 2. `log.info` satırlarının aşırı kullanımı
- **Dosya:** `AccountingServiceImplAGI.java`
- **Satır:** Birçok metot içinde
- **Açıklama:** Her adımda `log.info` kullanımı performans etkisi yaratabilir ve log dosyalarını şişirebilir. Kritik adımlar ve hata durumları için `log.debug` veya `log.trace` kullanılabilir.
- **Önerilen kod:**
```java
         log.debug("applyCalculatedCommission incomingTransaction: {}, clientDTO: {}", JsonUtil.toString(incomingTransaction), JsonUtil.toString(clientDTO));
```

### 1. `OutgoingTransactionIntbankService`'de `setCommissionDetails` metodu içinde gereksiz null kontrolü
- **Dosya:** `OutgoingTransactionIntbankService.java:526-527`
- **Sorun:** `dto.getCommissionCurrency()` null ise "EUR" atanıyor. Bu mantık doğru ancak `dto.getCommissionExpenseAccountNo()` ve `dto.getCommissionExpenseAccountCcy()` için de aynı pattern kullanılıyor. Bu, kod tekrarına neden olabilir.
- **Öneri:** Bu pattern'i bir utility metodu haline getirebilirsiniz. Ancak bu bir nitpick, kritik değil.

### 2. `OutgoingTransactionMapperService`'de `getExpenseAccountInformations` metodu içinde gereksiz null kontrolleri
- **Dosya:** `OutgoingTransactionMapperService.java:29-31`
- **Sorun:** `accountList` ve `body` null kontrolleri var. Ancak `accountList.getBody()` null ise `body` null olur ve sonraki if bloğu çalışmaz. Bu, kodun okunabilirliğini artırır ancak gereksiz bir null kontrolü olabilir.
- **Öneri:** Kodu daha okunabilir hale getirmek için null kontrollerini optimize edebilirsiniz.

### 1. `setCommissionExpenseAccountNoAndCurrency` metodunda gereksiz null-coalescing
Diff'te:
`model.getCommissionExpenseAccountNo() != null ? model.getCommissionExpenseAccountNo() : null`
Bu ifade, `model.getCommissionExpenseAccountNo()`'nun sonucunu doğrudan döndürür. Ternary operator gereksizdir.

**Önerilen kod:**
```java
outgoingTransactionDTO.setCommissionExpenseAccountNo(model.getCommissionExpenseAccountNo());
```

### 2. `setCommissionDetails` metodunda `BigDecimal` karşılaştırma optimizasyonu
`BigDecimal.ZERO.compareTo(dto.getCommissionAmount()) != 0` yerine `dto.getCommissionAmount().compareTo(BigDecimal.ZERO) != 0` veya `!dto.getCommissionAmount().equals(BigDecimal.ZERO)` daha okunaklı olabilir, ancak mevcut hali de çalışır. Asıl minor nokta, bu kontrolün neden yapıldığına dair yorum eksikliği.

### 3. Loglama tutarlılığı
`OutgoingTransactionProxyService`'deki yeni metotta `log.error` kullanılırken, `OutgoingTransactionServiceImpl`'deki yeni metotta `log.info` ve `log.error` kullanılıyor. `setCommissionExpenseAccountNoAndCurrency` metodunda hata durumunda `log.error` kullanılması doğru, ancak bu metodun `try-catch` ile sarmalanması (ve bu sarmalamanın gereksizliği) Minor olarak değerlendirilmiştir.

1. **Loglama satırlarında gereksiz JsonUtil.toString çağrıları**
   - **Dosya:** `OutgoingTransactionActionService.java:126, 128, 174`
   - **Bulgular:** `log.info` satırlarında `JsonUtil.toString(transaction)` kullanılması, transaction nesnesinin büyük olması durumunda performans sorunlarına yol açabilir. Ayrıca, bu loglar debug seviyesinde tutulmalı veya sadece kritik alanlar loglanmalıdır.
   - **Önerilen kod:**
     ```java
     log.debug("OutgoingTransactionActionService before transaction: {}", JsonUtil.toString(transaction));
     ```

2. **`setCommissionDetails` metodunda gereksiz try-catch bloğu**
   - **Dosya:** `OutgoingTransactionActionService.java:1038-1048`
   - **Bulgular:** `setCommissionDetails` metodu içindeki try-catch bloğu, basit setter çağrıları için gereksizdir. Exception fırlatılması durumunda, bu exception'ın üst katmanda işlenmesi daha uygundur.
   - **Önerilen kod:**
     ```java
     private void setCommissionDetails(OutgoingTransactionEntity screenTx, CheckDuplicateAndBalanceRequestDTO request) {
         if (screenTx.getCommissionAmount() != null && BigDecimal.ZERO.compareTo(screenTx.getCommissionAmount()) != 0) {
             screenTx.setCommissionCurrency(request.getCommissionCurrency() != null ? request.getCommissionCurrency() : "EUR");
             screenTx.setCommissionExpenseAccountNo(request.getCommissionExpenseAccountNo() != null ? request.getCommissionExpenseAccountNo() : "");
             screenTx.setCommissionExpenseAccountCcy(request.getCommissionExpenseAccountCcy() != null ? request.getCommissionExpenseAccountCcy() : "");
             log.info("resolveTransactions setCommissionDetails screenTx:{}", JsonUtil.toString(screenTx));
         }
     }
     ```

1. **Loglama Tutarsızlığı**
   - **Dosya:** `AccountingController.java:82`, `AccountingController.java:140`
   - **Sorun:** Log mesajlarında `"incomingAccountingAGI_Test"` ve `"incomingReverseAccountingAGI_Test"` stringleri hardcoded. Metod isimleri değişirse loglar kafa karıştırıcı olabilir.
   - **Önerilen kod:**
     ```java
     log.info("incomingAccountingAGI_Test transaction: {}", JsonUtil.toString(transaction));
     // veya
     log.info("Method: incomingAccountingAGI_Test, transaction: {}", JsonUtil.toString(transaction));
     ```

2. **Kod Tekrarı (DRY)**
   - **Dosya:** `AccountingController.java:45-100`, `AccountingController.java:117-155`
   - **Sorun:** İki metodda da `ClientDTO` ve `AccountResponseDTO` oluşturma, `StringUtil.nvl` kullanımı benzer. Bu tekrar bir helper metoda veya base service'e taşınabilir.
   - **Önerilen kod:**
     ```java
     private ClientDTO buildClientDTO(String clientNo) {
         ClientDTO clientDTO = new ClientDTO();
         clientDTO.setClientNo(clientNo);
         clientDTO.setSbuType("CORP");
         return clientDTO;
     }
     ```

3. **Yorum Satırları**
   - **Dosya:** `AccountingController.java:75-77`
   - **Sorun:** Comment'lerdeki değerler (`"394010010"`) kodun okunabilirliğini artırıyor ama gereksiz. Eğer bu değerler dinamikse comment'ler kaldırılmalı.
   - **Önerilen kod:**
     ```java
     // Comment'ler kaldırılmalı
     accounting.setGlAccount(dto.getGlAccount());
     ```

### 1. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.respose.ClientDTO;`
- **Açıklama:** `ClientDTO` import edilmiş ancak test sınıfında doğrudan kullanılmıyor (mock olarak değil, test verisi olarak kullanılıyor ama import path'inde `respose` yazımı dikkat çekici, muhtemelen `response` olmalıydı ama sınıfın kendisi bu path'te ise sorun yok, sadece import'un gereksiz olup olmadığına bakılmalı. Dosyada `ClientDTO` kullanılıyor: `ClientDTO clientDTO = new ClientDTO();`. Import gerekli.)
- **Düzeltme:** Import gerekli, minor değil. Ancak `respose` yazımı şüpheli. Eğer bu bir typo ise ve sınıfın adı `ClientDTO` ise ve package `com.ykb.nl.sepa.dto.respose` ise, bu bir yapısal sorun. Eğer package `com.ykb.nl.sepa.dto.response` olmalıysa ve dosya yanlış yerdeyse bu Critical olabilir. Ancak sadece diff'e bakarak package ismini değiştiremeyiz. Sadece not düşüyorum.

### 2. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.respose.ClientDTO;`
- **Açıklama:** `ClientDTO` kullanılıyor. Import gerekli.

### 3. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.client.ClientBeClient;`
- **Açıklama:** `ClientBeClient` mock olarak tanımlanmış (`@Mock private com.ykb.nl.sepa.external.client.ClientBeClient clientBeClient;`) ancak test metodlarında hiç kullanılmıyor.
- **Önerilen kod:**
```java
// @Mock private com.ykb.nl.sepa.external.client.ClientBeClient clientBeClient; // Kullanılmıyor, silinmeli.
```

### 4. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.soapha.config.SwiftProperties;`
- **Açıklama:** `swiftProperties` mock olarak tanımlanmış (`@Mock private com.ykb.nl.sepa.external.soapha.config.SwiftProperties swiftProperties;`) ancak test metodlarında hiç kullanılmıyor.
- **Önerilen kod:**
```java
// @Mock private com.ykb.nl.sepa.external.soapha.config.SwiftProperties swiftProperties; // Kullanılmıyor, silinmeli.
```

### 5. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.client.NbsAdapterClient;`
- **Açıklama:** `nbsAdapterClient` mock olarak tanımlanmış (`@Mock private com.ykb.nl.sepa.external.client.NbsAdapterClient nbsAdapterClient;`) ancak test metodlarında hiç kullanılmıyor.
- **Önerilen kod:**
```java
// @Mock private com.ykb.nl.sepa.external.client.NbsAdapterClient nbsAdapterClient; // Kullanılmıyor, silinmeli.
```

### 6. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.ValidationContraAccountDto;`
- **Açıklama:** `ValidationContraAccountDto` kullanılıyor. Import gerekli.

### 7. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.ContraAccountResponse;`
- **Açıklama:** `ContraAccountResponse` kullanılıyor. Import gerekli.

### 8. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.FindCommissionRequestDTO;`
- **Açıklama:** `FindCommissionRequestDTO` kullanılıyor. Import gerekli.

### 9. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.FindCommissionResponseDTO;`
- **Açıklama:** `FindCommissionResponseDTO` kullanılıyor. Import gerekli.

### 10. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.AccountResponseDTO;`
- **Açıklama:** `AccountResponseDTO` kullanılıyor. Import gerekli.

### 11. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.exception.SepaOutgoingSaveException;`
- **Açıklama:** `SepaOutgoingSaveException` kullanılıyor. Import gerekli.

### 12. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.client.ClientBeClient;`
- **Açıklama:** `ClientBeClient` kullanılıyor. Import gerekli.

### 13. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.client.NbsAdapterClient;`
- **Açıklama:** `NbsAdapterClient` kullanılıyor. Import gerekli.

### 14. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.dto.SepaBaseResponse;`
- **Açıklama:** `SepaBaseResponse` kullanılıyor. Import gerekli.

### 15. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import org.junit.jupiter.api.Test;`
- **Açıklama:** `@Test` kullanılıyor. Import gerekli.

### 16. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import org.junit.jupiter.api.extension.ExtendWith;`
- **Açıklama:** `@ExtendWith` kullanılıyor. Import gerekli.

### 17. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import org.mockito.InjectMocks;`
- **Açıklama:** `@InjectMocks` kullanılıyor. Import gerekli.

### 18. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import org.mockito.Mock;`
- **Açıklama:** `@Mock` kullanılıyor. Import gerekli.

### 19. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import org.mockito.junit.jupiter.MockitoExtension;`
- **Açıklama:** `MockitoExtension` kullanılıyor. Import gerekli.

### 20. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import org.springframework.http.ResponseEntity;`
- **Açıklama:** `ResponseEntity` kullanılıyor. Import gerekli.

### 21. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import java.util.List;`
- **Açıklama:** `List` kullanılıyor. Import gerekli.

### 22. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertEquals;`
- **Açıklama:** `assertEquals` kullanılıyor. Import gerekli.

### 23. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertFalse;`
- **Açıklama:** `assertFalse` kullanılmıyor. Sadece `assertTrue` ve `assertThrows` kullanılıyor.
- **Önerilen kod:**
```java
// import static org.junit.jupiter.api.Assertions.assertFalse; // Kullanılmıyor, silinmeli.
```

### 24. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertThrows;`
- **Açıklama:** `assertThrows` kullanılıyor. Import gerekli.

### 25. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import static org.mockito.ArgumentMatchers.any;`
- **Açıklama:** `any` kullanılıyor. Import gerekli.

### 26. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import static org.mockito.Mockito.when;`
- **Açıklama:** `when` kullanılıyor. Import gerekli.

### 27. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertEquals;`
- **Açıklama:** `assertEquals` kullanılıyor. Import gerekli.

### 28. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertFalse;`
- **Açıklama:** `assertFalse` kullanılıyor. Import gerekli.

### 29. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertNotNull;`
- **Açıklama:** `assertNotNull` kullanılıyor. Import gerekli.

### 30. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertTrue;`
- **Açıklama:** `assertTrue` kullanılıyor. Import gerekli.

### 31. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.mockito.ArgumentMatchers.any;`
- **Açıklama:** `any` kullanılıyor. Import gerekli.

### 32. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.mockito.Mockito.doThrow;`
- **Açıklama:** `doThrow` kullanılıyor. Import gerekli.

### 33. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.mockito.Mockito.times;`
- **Açıklama:** `times` kullanılıyor. Import gerekli.

### 34. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.mockito.Mockito.verify;`
- **Açıklama:** `verify` kullanılıyor. Import gerekli.

### 35. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import static org.mockito.Mockito.when;`
- **Açıklama:** `when` kullanılıyor. Import gerekli.

### 36. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import java.math.BigDecimal;`
- **Açıklama:** `BigDecimal` kullanılıyor. Import gerekli.

### 37. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import java.util.Date;`
- **Açıklama:** `Date` kullanılıyor. Import gerekli.

### 38. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import java.util.List;`
- **Açıklama:** `List` kullanılıyor. Import gerekli.

### 39. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.batch.instantpayments.business.InstantPaymentsConsts;`
- **Açıklama:** `InstantPaymentsConsts` kullanılıyor. Import gerekli.

### 40. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dao.entity.IncomingTransactionEntityWR;`
- **Açıklama:** `IncomingTransactionEntityWR` kullanılıyor. Import gerekli.

### 41. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.AccountResponseDTO;`
- **Açıklama:** `AccountResponseDTO` kullanılıyor. Import gerekli.

### 42. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.params.SendSepaIncomingInstantEmailParams;`
- **Açıklama:** `SendSepaIncomingInstantEmailParams` kullanılıyor. Import gerekli.

### 43. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.dto.respose.ClientDTO;`
- **Açıklama:** `ClientDTO` kullanılıyor. Import gerekli.

### 44. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.client.CosmosAccountClient;`
- **Açıklama:** `CosmosAccountClient` kullanılıyor. Import gerekli.

### 45. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.dto.sepa.SepaAccountingDto;`
- **Açıklama:** `SepaAccountingDto` kullanılıyor. Import gerekli.

### 46. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.email.service.EmailServiceSepaInstant;`
- **Açıklama:** `EmailServiceSepaInstant` kullanılıyor. Import gerekli.

### 47. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.service.AccountingServiceImplAGI;`
- **Açıklama:** `AccountingServiceImplAGI` kullanılıyor. Import gerekli.

### 48. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.service.IncomingTransactionServiceWR;`
- **Açıklama:** `IncomingTransactionServiceWR` kullanılıyor. Import gerekli.

### 49. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.service.ServiceLocator;`
- **Açıklama:** `ServiceLocator` kullanılıyor. Import gerekli.

### 50. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.service.TransactionCommonServiceUse;`
- **Açıklama:** `TransactionCommonServiceUse` kullanılıyor. Import gerekli.

### 51. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import org.junit.jupiter.api.Test;`
- **Açıklama:** `@Test` kullanılıyor. Import gerekli.

### 52. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import org.junit.jupiter.api.extension.ExtendWith;`
- **Açıklama:** `@ExtendWith` kullanılıyor. Import gerekli.

### 53. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import org.mockito.InjectMocks;`
- **Açıklama:** `@InjectMocks` kullanılıyor. Import gerekli.

### 54. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import org.mockito.Mock;`
- **Açıklama:** `@Mock` kullanılıyor. Import gerekli.

### 55. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import org.mockito.junit.jupiter.MockitoExtension;`
- **Açıklama:** `MockitoExtension` kullanılıyor. Import gerekli.

### 56. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import org.springframework.http.ResponseEntity;`
- **Açıklama:** `ResponseEntity` kullanılıyor. Import gerekli.

### 57. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.client.ClientBeClient;`
- **Açıklama:** `ClientBeClient` kullanılmıyor.
- **Önerilen kod:**
```java
// import com.ykb.nl.sepa.external.client.ClientBeClient; // Kullanılmıyor, silinmeli.
```

### 58. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.soapha.config.SwiftProperties;`
- **Açıklama:** `SwiftProperties` kullanılmıyor.
- **Önerilen kod:**
```java
// import com.ykb.nl.sepa.external.soapha.config.SwiftProperties; // Kullanılmıyor, silinmeli.
```

### 59. Gereksiz import
- **Dosya:** `AccountingValidatorAGINewCoverageTest.java`
- **Satır:** `import com.ykb.nl.sepa.external.client.NbsAdapterClient;`
- **Açıklama:** `NbsAdapterClient` kullanılmıyor.
- **Önerilen kod:**
```java
// import com.ykb.nl.sepa.external.client.NbsAdapterClient; // Kullanılmıyor, silinmeli.
```

### 60. Gereksiz import
- **Dosya:** `AccountServiceImplAdditionalCoverageTest.java`
- **Satır:** `import static org.junit.jupiter.api.Assertions.assertFalse;`
- **Açıklama:** `assertFalse` kullanılmıyor.
- **Önerilen kod:**
```java
// import static org.junit.jupiter.api.Assertions.assertFalse; // Kullanılmıyor, silinmeli.
```

1. **Test metot isimleri uzun ve tekrarlayan**
   - **Dosya:** `AccountServiceImplCoverageBoosterTest.java`
   - **Açıklama:** Test metot isimleri oldukça uzun ve `getValidateContraIbanByIbanNo_when...` gibi pattern'ler tekrarlanıyor. JUnit 5'te `@DisplayName` kullanılarak daha okunabilir test isimleri verilebilir.
   - **Önerilen Kod:**
     ```java
     @Test
     @DisplayName("Contra IBAN validation should return null flag when status is FAIL")
     void getValidateContraIbanByIbanNo_whenResponseStatusNotSuccess_returnsDefaultWithNullFlag() {
         // ...
     }
     ```

2. **Hardcoded değerler**
   - **Dosya:** `AccountServiceImplCoverageBoosterTest.java`
   - **Açıklama:** Testlerde `42L`, `7L`, `11L`, `"EUR"`, `"DDP"`, `"DDPS"`, `"ALL"`, `"TR-IBAN"` gibi hardcoded değerler kullanılmış. Bu değerler, testin amacını açıkça ortaya koymak için uygun olsa da, gelecekte bu değerlerin değişmesi durumunda testlerin güncellenmesi gerekebilir. Bu değerler, test sınıfının üstünde `static final` alanlar olarak tanımlanabilir.
   - **Önerilen Kod:**
     ```java
     private static final Long CLIENT_NO_1 = 42L;
     private static final Long CLIENT_NO_2 = 7L;
     private static final Long CLIENT_NO_3 = 11L;
     private static final String EUR = "EUR";
     private static final String DDP = "DDP";
     private static final String DDPS = "DDPS";
     private static final String ALL = "ALL";
     private static final String TR_IBAN = "TR-IBAN";
     ```

1. **Tekrarlanan Arrange kodu**
   - **Dosya:** `AccountingExternalServiceComprehensiveTest.java:50-55, 65-70, 80-85` vb.
   - **Sorun:** Her test metodunda `ExchangeParityConvertResponseDTO`, `SepaBaseResponse` ve `ResponseEntity` oluşturuluyor. Bu kod tekrarını azaltmak için helper metotlar veya `@BeforeEach` içinde daha esnek bir yapı kullanılabilir.
   - **Önerilen Kod:**
     ```java
     private SepaBaseResponse<ExchangeParityConvertResponseDTO> createSuccessResponse(BigDecimal amount) {
         ExchangeParityConvertResponseDTO responseDTO = new ExchangeParityConvertResponseDTO();
         responseDTO.setAmount(amount);
         SepaBaseResponse<ExchangeParityConvertResponseDTO> sepaBaseResponse = new SepaBaseResponse<>();
         sepaBaseResponse.setData(responseDTO);
         return sepaBaseResponse;
     }
     ```

2. **`testConvertAmount_VerifyRequestParameters` testinde assertion eksikliği**
   - **Dosya:** `AccountingExternalServiceComprehensiveTest.java:260-265`
   - **Sorun:** Test, `nbsAdapterClient`'ın çağrıldığını doğruluyor ancak dönen response'un işlenip işlenmediğini test etmiyor. `result` değişkeni kullanılmıyor.
   - **Önerilen Kod:**
     ```java
     @Test
     void testConvertAmount_VerifyRequestParameters() {
         // Arrange
         lenient().when(nbsAdapterClient.convertExchangeParityAmountByRate(any(ExchangeParityByRateConvertRequestDTO.class)))
                 .thenReturn(new ResponseEntity<>(sepaBaseResponse, org.springframework.http.HttpStatus.OK));

         // Act
         BigDecimal result = service.convertAmount(BigDecimal.valueOf(100.00), "EUR", "USD");

         // Assert - Verify the parameters passed to the client
         verify(nbsAdapterClient, times(1)).convertExchangeParityAmountByRate(argThat(req ->
             req.getAmount().equals(BigDecimal.valueOf(100.00)) &&
             req.getSourceCurrency().equals("EUR") &&
             req.getDestinationCurrency().equals("USD")
         ));
         assertNotNull(result);
         assertEquals(BigDecimal.valueOf(110.00), result);
     }
     ```

1. **Test metot isimlerinde `WR` kısaltmasının tutarlı kullanımı**
   - Dosya: `AccountingServiceImplAGICoverageBoosterTest.java`
   - Sorun: Test metot isimlerinde `IncomingInstantWR` geçiyor (`setConvComAmountForIncomingInstantWR`). Bu kısaltmanın (Write-Back? Wrapper?) anlamı test okuyucusu için net değil. Eğer bu bir domain terimi ise sorun yok, ancak okunabilirlik için açıklayıcı olabilir.
   - Öneri: Mevcut isimlendirmeyi koru ancak kod yorumlarında veya dokümantasyonda `WR`'nin ne anlama geldiğini belirt.

2. **Hardcoded IBAN ve değerler**
   - Dosya: `AccountingServiceImplAGICoverageBoosterTest.java:100-101`
   - Sorun: `NL00YKBK0000000000` ve `NL11DIFFERENT000000` gibi hardcoded IBAN'lar kullanılmış. Bu testler için kabul edilebilir olsa da, IBAN validasyon kuralları (Luhn algoritması vb.) test edilmiyorsa, sadece string eşleşmesi yapılıyor.
   - Öneri: IBAN validasyonunun da test edildiğinden emin olun veya bu testin sadece repository çağrısını mock ettiğini belirtin.

1. **Magic Number: `new BigDecimal("5")`**
   - **Dosya:** `AccountingServiceImplAGIFinalCoverageTest.java:45, 57`
   - **Sorun:** Test verilerinde kullanılan `5` sayısı magic number. Anlamı açık değil.
   - **Öneri:**
     ```java
     private static final BigDecimal TEST_COMMISSION_AMOUNT = new BigDecimal("5");
     // ...
     tx.setCommissionAmount(TEST_COMMISSION_AMOUNT);
     ```

2. **`RuntimeException` kullanımı**
   - **Dosya:** `AccountingServiceImplAGIFinalCoverageTest.java:58`
   - **Sorun:** `thenThrow(new RuntimeException("fail"))` yerine domain-specific bir exception kullanılabilir veya en azından daha açıklayıcı bir mesaj verilmeli.
   - **Öneri:**
     ```java
     thenThrow(new RuntimeException("Currency conversion failed"))
     ```

3. **Test metodlarında `any()` kullanımı**
   - **Dosya:** `AccountingServiceImplAGIFinalCoverageTest.java:100-103`
   - **Sorun:** `any()` matcher'ı kullanılması, metodun hangi argümanlarla çağrıldığını test etmez. Bu, testin doğruluğunu azaltır. Mümkünse `eq()` veya specific argümanlarla mock tanımlanmalı.
   - **Öneri:**
     ```java
     // Eğer spesifik bir argüman bekleniyorsa:
     when(nbsAdapterClient.getFindCommission(eq(expectedArg))).thenReturn(ResponseEntity.ok(null));
     ```

1. **Gereksiz import: `org.mockito.Mockito`**
   - File: `src/test/java/com/ykb/nl/sepa/service/AccountingServiceImplAGIUncoveredLinesTest.java:123`
   - Issue: `org.mockito.Mockito.verify` yerine `Mockito.verify` veya statik import kullanılabilir. Dosyanın başında `import static org.mockito.Mockito.*;` eklenerek `org.mockito.Mockito.verify` yerine `verify` kullanılabilir.
   - Önerilen kod:
     ```java
     import static org.mockito.Mockito.*;
     // ...
     verify(nbsAdapterClient).incomingInstantReverse(captor.capture());
     ```

2. **Test metot isimleri uzun ve detaylı**
   - File: `src/test/java/com/ykb/nl/sepa/service/AccountingServiceImplAGIUncoveredLinesTest.java`
   - Issue: Test metot isimleri (`applyCalculatedCommission_whenFindCommissionSuccess_setsCommissionAndExpenseFields`) oldukça uzun. JUnit convention'larına uygun olsa da okunabilirlik için kısaltılabilir.
   - Önerilen kod:
     ```java
     @Test
     void applyCalculatedCommission_success_setsFields() { ... }
     ```

3. **`new BigDecimal("5")` yerine `BigDecimal.valueOf(5)` veya `BigDecimal.ZERO` kullanımı**
   - File: `src/test/java/com/ykb/nl/sepa/service/AccountingServiceImplAGIUncoveredLinesTest.java:131`
   - Issue: `new BigDecimal("5")` yerine `BigDecimal.valueOf(5)` daha okunaklı olabilir. Ancak bu bir stil tercihi.
   - Önerilen kod:
     ```java
     service.setCRValues(new ClientDTO(), new IncomingTransactionEntityWR(), dto, BigDecimal.valueOf(5), response);
     ```

### 1. Test Metod İsimlendirme Standartları
- **Dosya:** `AccountingServiceImplComprehensiveTest.java`
- **Bulgulama:** Test metod isimleri `testOutgoingTransaction_Success` gibi. JUnit 5'te `test` prefix'i genellikle tercih edilmez (JUnit 4'ten kalma).
- **Neden Önemli:** Kod okunabilirliği ve standart uyumu açısından `should...When...` veya `..._Success` formatı daha yaygındır.
- **Önerilen kod:**
```java
void outgoingTransaction_ShouldReturnResponse_WhenValidRequest()
```

### 2. Magic Number / Hardcoded Değerler
- **Dosya:** `AccountingServiceImplComprehensiveTest.java`
- **Bulgulama:** `BigDecimal.valueOf(100.00)`, `BigDecimal.valueOf(5.00)` gibi hardcoded değerler.
- **Neden Önemli:** Test verilerindeki bu değerler, testin amacını netleştirmek için sabitler olarak tanımlanabilir veya daha anlamlı isimlerle ifade edilebilir.
- **Önerilen kod:**
```java
private static final BigDecimal TEST_AMOUNT = BigDecimal.valueOf(100.00);
private static final BigDecimal TEST_COMMISSION = BigDecimal.valueOf(5.00);
```

### 3. Gereksiz Importlar
- **Dosya:** `AccountingServiceImplComprehensiveTest.java`
- **Bulgulama:** `java.util.*` gibi wildcard importlar kullanılmış.
- **Neden Önemli:** Kod temizliği ve okunabilirliği için spesifik importlar tercih edilmelidir.
- **Önerilen kod:**
```java
import java.util.List;
import java.util.Date;
// ... diğer spesifik importlar
```

### Test Coverage Azaltımı (Regression Risk)
- **Dosya:** `AccountingServiceImplCoverageTest.java:95-130` (Diff'te silinen kısım)
- **Açıklama:** `outgoingTransaction_successAndException` test metodu tamamen silinmiş. Bu test, `outgoingTransaction` metodunun başarılı durum ve `RuntimeException` fırlattığı durumları (null dönmesi) kontrol ediyordu.
- **Neden Önemli:** PR açıklamasında "unit test eklendi" denilse de, mevcut bir testin silinmesi test coverage'ını düşürür ve bu spesifik exception handling path'ini koruyan bir test kalmamış olabilir. Eğer bu test başka bir yere taşındıysa veya `doAccounting` testleri bu path'i kapsıyorsa, bu bir Minor (dokümantasyon/izlenebilirlik) issue'dur; ancak kapsam dışı bırakıldıysa Critical bir regression riskidir.
- **Öneri:** Bu testin neden silindiğini veya kapsamının başka bir teste (örneğin `doAccounting_happyPath_firstRetryEmail_and_expiredPath`) geçtiğini doğrulayın. Eğer `outgoingTransaction` metodu hala bağımsız olarak test edilebilir bir unit ise, bu testin geri eklenmesi veya `doAccounting` içindeki bu path'in test edildiğinin kanıtlanması gerekir.

```java
// Eğer bu test silindiyse, doAccounting testinde bu path'in test edildiğinden emin olun.
// Aksi takdirde, outgoingTransaction metodunun exception handling'ini test eden bir birim test eksik kalır.
```

### 1. Test isimlerinde `when...and...` yapısının karmaşıklığı
Test isimleri oldukça uzun ve koşulları detaylandırıyor (`validate_whenNbsInactive_andClientLookupThrows_stillReturnsConvertedResponse`). Bu, testin neyi test ettiğini netleştirse de okunabilirliği biraz düşürüyor. Daha kısa ve öz isimler tercih edilebilir, ancak mevcut yapı da kabul edilebilir.

### 2. `mock(ResponseEntity.class)` kullanımı
`OutgoingTransactionMapperServiceTest` dosyasında, `ResponseEntity` mock'lamak için `mock(ResponseEntity.class)` kullanılmış. Bu, generic tip bilgisi olmadan mock oluşturur ve `@SuppressWarnings("unchecked")` gerektirir. `Mockito.mock(ResponseEntity.class)` yerine, eğer mümkünse, daha spesifik bir mock stratejisi veya `lenient()` kullanımı düşünülebilir, ancak bu durumda generic cast zorunluluğu var. Bu bir minor issue olarak kabul edilebilir.

**Önerilen kod:**
```java
// Generic cast yerine, eğer ResponseEntity'nin yapısı izinliyorsa,
// daha güvenli bir mock kurulumu düşünülebilir. Ancak mevcut yöntem de yaygındır.
```

### 1. Magic Numbers in Tests
- **File:** `OutgoingTransactionServiceImplCoverageBoosterTest.java`
- **Issue:** Uses magic numbers like `1000L` for `Date`, `"TX-100"`, `"SEPA-1"`, `9L` for IDs.
- **Why it matters:** Magic numbers reduce readability and make tests harder to maintain.
- **Önerilen kod:**
```java
private static final String TEST_SEPA_TRANSACTION_ID = "TX-100";
private static final Long TEST_ENTITY_ID = 9L;

// Usage:
when(outgoingTransactionRepository.findBySepaTransactionId(TEST_SEPA_TRANSACTION_ID)).thenReturn(entity);
```

### 2. Unused Imports
- **File:** `OutgoingTransactionServiceImplCoverageBoosterTest.java`
- **Issue:** Imports `OutgoingTransactionMt101Service` and `TransactionHistoryService` are declared as mocks but never used in any test method.
- **Why it matters:** Unused imports clutter the code and can be confusing.
- **Önerilen kod:**
```java
// Remove unused mock fields:
// @Mock private OutgoingTransactionMt101Service outgoingTransactionMt101Service;
// @Mock private TransactionHistoryService transactionHistoryService;
```

### 3. Test Method Naming
- **File:** `OutgoingTransactionServiceImplCoverageBoosterTest.java`
- **Issue:** Test method names like `getIdBySepaTransactionId_delegatesToRepository` are descriptive but could be more concise.
- **Why it matters:** While descriptive, they are verbose. Standard naming conventions like `shouldReturnIdWhenSepaTransactionIdExists` are often preferred.
- **Önerilen kod:**
```java
@Test
void shouldReturnIdWhenSepaTransactionIdExists() {
    // ...
}
```

#### 1. Gereksiz importlar
- **File:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionServiceImplCoverageGapsTest.java`
- **Issue:** Test sınıfında çok sayıda `@Mock` var ama hepsi kullanılmıyor. Örneğin `OutgoingTransactionMasterServiceWR`, `OutgoingTransactionPersistenceService`, `Javers`, `SwiftProperties`, `WorkflowClient`, `OutgoingTransactionValidator`, `OutgoingTransactionCustomRepository`, `OutgoingTransactionRepository`, `AccountingService`, `OutgoingTransactionRepositoryWR`, `OutgoingTransactionServiceWR`, `SepaIdGenerationBase`, `AccountService`, `ReachAgentService`, `OutgoingTransactionInstantValidator`, `OutgoingTransactionMapperService`, `OutgoingTransactionActionService`, `UserClient`, `AuditorAware`, `TransactionHistoryService`, `TransactionMonitoringRepository`, `OutgoingTransactionMt101Service` gibi mock'lar test metodlarında kullanılmıyor.
- **Why it matters:** Kod okunabilirliğini düşürür, gereksiz bağımlılık yaratır.
- **How to fix:** Kullanılmayan `@Mock` alanlarını silin.

**Önerilen kod**
```java
// Kullanılan mock'lar:
@Mock private ServiceLocator serviceLocator;
@Mock private OutgoingTransactionMapper outgoingTransactionMapper;
@Mock private OutgoingTransactionWorkFlowService outgoingTransactionWorkFlowService;
@Mock private FeatureService featureService;
@Mock private TransactionCommonServiceUse transactionCommonService;
@Mock private OutgoingTransactionValidator outgoingTransactionValidator;
@Mock private OutgoingTransactionRepositoryWR outgoingTransactionRepositoryWR;
@Mock private OutgoingTransactionServiceWR outgoingTransactionServiceWR;
@Mock private AccountService accountService;
@Mock private OutgoingTransactionInstantValidator instantValidator;
@Mock private OutgoingTransactionActionService outgoingTransactionActionService;
@Mock private UserClient userClient;
@Mock private AuditorAware<String> defaultAuditorAware;
@Mock private TransactionHistoryService transactionHistoryService;
@Mock private TransactionMonitoringRepository transactionMonitoringRepository;
@Mock private OutgoingTransactionMt101Service outgoingTransactionMt101Service;

// Kullanılmayan mock'ları silin.
```

#### 2. `RuntimeException` kullanımı
- **File:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionServiceImplCoverageGapsTest.java:105`
- **Issue:** `thenThrow(new RuntimeException("boom"))` yerine spesifik bir exception kullanılması daha iyidir.
- **Why it matters:** Testin amacı belirli bir exception'ın yakalanıp işlenip işlenmediğini test etmektir. `RuntimeException` çok geneldir.
- **How to fix:** İlgili servisin fırlattığı spesifik exception'ı kullanın.

**Önerilen kod**
```java
when(transactionCommonService.getGroupCifInfoByGroupCode(1L))
    .thenThrow(new SpecificServiceException("boom"));
```

#### 3. Test adı ve içeriği uyumsuzluğu
- **File:** `src/test/java/com/ykb/nl/sepa/service/OutgoingTransactionServiceImplCoverageGapsTest.java:115`
- **Issue:** Test adı `updateInquiryClientInfo_whenClientNoNull_doesNothing` ama assertion `dto.getJointType()` üzerinde. Metodun adı `updateInquiryClientInfo` ve parametre `TransactionQueryResponseDTO`. Test, `debtorClientNo` null olduğunda `jointType`'in null kalmasını bekliyor. Bu mantıklı ama test adı "doesNothing" diyor. Eğer metod başka bir şey yapmıyorsa bu doğru. Ancak test adı daha açıklayıcı olabilir.
- **Why it matters:** Test okunabilirliği.
- **How to fix:** Test adını daha açıklayıcı yapın.

**Önerilen kod**
```java
@Test
void updateInquiryClientInfo_whenDebtorClientNoNull_jointTypeNotSet() {
    // ...
}
```

1. **Test metod isimleri uzun ve okunabilir**
   - **Dosya:** `OutgoingTransactionServiceImplUncoveredLinesTest.java`
   - **Açıklama:** Test metod isimleri (örn: `getOutgoingTransactionsByWorkflowReferenceId_whenMasterNull_returnsEmptyList`) JUnit convention'larına uygun ancak çok uzun. Okunabilirlik için kısaltılabilir veya daha kısa alt başlıklar kullanılabilir.
   - **Öneri:** İsimleri daha kısa ve öz hale getir.
   ```java
   @Test
   void getOutgoingTransactionsByWorkflowReferenceId_nullMaster_returnsEmpty() { ... }
   ```

2. **Hardcoded string değerler**
   - **Dosya:** `OutgoingTransactionServiceImplUncoveredLinesTest.java`
   - **Açıklama:** Testlerde "WF-1", "WF-2", "BULK", "INTBANK", "S1" gibi hardcoded string değerler kullanılmış. Bu değerler sabitler olarak tanımlanabilir veya daha anlamlı isimlerle ifade edilebilir.
   - **Öneri:** Sabitleri sınıf seviyesinde tanımla.
   ```java
   private static final String WORKFLOW_REF_NULL = "WF-1";
   private static final String PROCESS_CHANNEL_BULK = "BULK";
   ```

3. **`transactionCommonService` mock'ının gereksiz kullanımı**
   - **Dosya:** `OutgoingTransactionServiceImplUncoveredLinesTest.java`
   - **Açıklama:** `getOutgoingTransactionsByClientNo` testinde `transactionCommonService.getParameterValueFromCache` mock'lanmış ancak bu metodun test edilen fonksiyonun akışında gerçekten kullanılıp kullanılmadığı net değil. Eğer kullanılmıyorsa, bu mock gereksizdir.
   - **Öneri:** Test edilen metodun gerçekten bu servisi kullandığından emin ol, yoksa mock'u kaldır.

### 1. Test Metod İsimlendirme ve Açıklama Eksikliği
- **File:** `OutgoingTransactionActionServiceCoverageGapsTest.java`
- **Issue:** Test metod isimleri (`hitCheckControl_whenNotRetl_setsWaitToBeSentEmb`) genel mantığı anlatıyor ancak "N" ve "CORP" gibi hardcoded string değerleri metod isminde veya assertion'larda açıklanmamış. "N" ve "CORP" değerlerinin ne anlama geldiği (örn. `instantPaymentFlag` ve `sbuType`) yorum satırı veya daha açıklayıcı değişkenlerle belirtilmeli.
- **Why it matters:** Testin amacı ve girdi değerlerinin işlevi yeni geliştirici için net olmayabilir.
- **Önerilen kod:**
```java
@Test
void hitCheckControl_whenNotRetl_setsWaitToBeSentEmb() {
    // Arrange
    OutgoingTransactionEntity entity = new OutgoingTransactionEntity();
    // N: Not RETL (Retail), CORP: Corporate
    String instantPaymentFlag = "N"; 
    String sbuType = "CORP";

    // Act
    service.hitCheckControl(entity, instantPaymentFlag, sbuType);

    // Assert
    assertEquals(WAIT_TO_BE_SENT_EMB, entity.getTransactionStatus());
}
```

### 2. `OutgoingTransactionActionServiceOthersTest.java` Dosyasında `@SuppressWarnings("all")` Kullanımı
- **File:** `OutgoingTransactionActionServiceOthersTest.java:56`
- **Issue:** `@SuppressWarnings("all")` kullanımı, potansiyel warning'lerin gizlenmesine neden olur. Bu, kod kalitesini düşürür ve potansiyel sorunların fark edilmesini engeller.
- **Why it matters:** Kod kalitesi ve bakılabilirlik düşer.
- **Önerilen kod:**
```java
// @SuppressWarnings("all") yerine, spesifik warning'ler için @SuppressWarnings("unchecked")
// veya benzeri daha spesifik bir annotation kullanın.
// Örneğin:
@SuppressWarnings("unchecked")
class OutgoingTransactionActionServiceOthersTest { ... }
```

1. **Yinelenen Arrange kodu**
   - Dosya: `AccountingControllerComprehensiveTest.java`
   - Satır: `testIncomingAccountingAGI_Success`, `testIncomingAccountingAGI_WithErrorResponse`, `testIncomingAccountingAGI_NullResponse`
   - Sorun: `@BeforeEach`'de setup edilen `dto`, `transactionWR`, `transaction` gibi nesneler ve mock ayarları test metodlarında tekrar tekrar yazılıyor. Bu, kod tekrarına ve bakım zorluğuna yol açar.
   - Neden önemli: Kod tekrarı, bakım maliyetini artırır ve hata yapma olasılığını yükseltir.
   - Öneri:
   ```java
   // Helper method'lar kullanılmalı
   private SepaBaseResponse<SepaAccountingDto> createSuccessResponse() {
       SepaAccountingDto responseData = new SepaAccountingDto();
       responseData.setContractNo(1L);
       responseData.setValueDate(new Date());
       responseData.setAccountingStatus("O");
       responseData.setFccaBaseEqu(BigDecimal.valueOf(100.00));
       responseData.setConvComAmount(BigDecimal.valueOf(5.00));
       responseData.setErrorMessage(null);

       SepaBaseResponse<SepaAccountingDto> response = new SepaBaseResponse<>();
       response.setData(responseData);
       return response;
   }
   ```

2. **`Date` nesneleri için `new Date()` kullanımı**
   - Dosya: `AccountingControllerComprehensiveTest.java`
   - Satır: `setUp`, `testIncomingAccountingAGI_Success`, vb.
   - Sorun: `new Date()` kullanımı, testlerin deterministik olmasını zorlaştırır. Özellikle `testUpdateTransactionStatusReversed_UpdateDate` testinde `beforeUpdate` ve `result.getUpdateDate()` karşılaştırması yapılırken, `new Date()` çağrıları arasındaki zaman farkı testin başarısız olmasına neden olabilir.
   - Neden önemli: Deterministik testler, tekrarlanabilirlik ve güvenilirlik için önemlidir.
   - Öneri:
   ```java
   // Fixed date'ler kullanılmalı
   private static final Date FIXED_DATE = Date.from(Instant.parse("2023-01-01T00:00:00Z"));
   ```

3. **`ClientDTO` ve `AccountResponseDTO` nesneleri kullanılmıyor**
   - Dosya: `AccountingControllerComprehensiveTest.java`
   - Satır: `clientDTO`, `accountResponseDTO` tanımları ve `setUp` içindeki ayarları
   - Sorun: Bu nesneler `setUp`'ta oluşturulup ayarlanıyor ancak hiçbir test metodunda kullanılmıyor. Bu, gereksiz kod tekrarına ve okunabilirliği düşürür.
   - Neden önemli: Kullanılmayan kod, bakım zorluğunu artırır ve kod tabanını gereksiz yere şişirir.
   - Öneri:
   ```java
   // Kullanılmayan nesneler kaldırılmalı
   // private ClientDTO clientDTO;
   // private AccountResponseDTO accountResponseDTO;
   ```

1. **Test metotlarının isimlendirme standardı**
   - **Dosya:** `AccountingControllerCoverageGapsTest.java:41` ve `AccountingControllerCoverageGapsTest.java:68`
   - **Sorun:** Test metotlarının isimleri `incomingAccountingAGI_whenResponseDataNull_stillReturnsOk` ve `incomingReverseAccountingAGI_whenResponseEntityNull_stillReturnsOk` şeklinde. Bu isimler açıklayıcı olsa da, daha kısa ve öz olabilir.
   - **Neden Önemli:** Test metotlarının isimleri kısa ve öz olmalı, ancak neyi test ettiğini açıkça belirtmeli.
   - **Önerilen kod:**
     ```java
     @Test
     void incomingAccountingAGI_shouldReturnOk_whenResponseDataNull() {
         // ...
     }

     @Test
     void incomingReverseAccountingAGI_shouldReturnOk_whenResponseEntityNull() {
         // ...
     }
     ```

2. **Yardımcı metotların private olması**
   - **Dosya:** `AccountingControllerCoverageGapsTest.java:93-125`
   - **Sorun:** `dto()`, `txWr()`, ve `tx()` metotları private olarak tanımlanmış. Bu, test sınıfı içinde doğru bir şekilde kullanılıyor. Ancak, bu metotların isimleri daha açıklayıcı olabilir.
   - **Neden Önemli:** Yardımcı metotların isimleri, ne yaptığını açıkça belirtmeli.
   - **Önerilen kod:**
     ```java
     private AccountingControllerDTO createAccountingControllerDTO() {
         // ...
     }

     private IncomingTransactionEntityWR createIncomingTransactionEntityWR() {
         // ...
     }

     private IncomingTransactionEntity createIncomingTransactionEntity() {
         // ...
     }
     ```

## Sonuç
Needs work — Critical bulgu var.
