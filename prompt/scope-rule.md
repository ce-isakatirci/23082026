`#### Diff` = asıl review kaynağı (PR changes).

`#### File` / `#### File (related context, read-only)` = doğrulama; style nitpick değil.

Yalnızca Diff ile ilgili (veya Diff’in related’da kanıtladığı) bulgu. Bağlantısız mevcut kod eleştirisi yok.

**Nitpick yazma (defect / breaking yoksa):**
- gereksiz else
- early-return kozmetiği
- ternary satır kırımı
- salt formatting / whitespace

Naming, REST path, anlamlı exception → Minor olabilir; yukarıdakiler değil.
