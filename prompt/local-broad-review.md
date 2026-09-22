# Local broad review (tek geçiş)

Bu oturum **yalnız diff** değil ve **chunk yok**. Extension PR commit'ine local repo cache (clone veya fetch + checkout) yaptı; CodeGraph ile related dosyalar user mesajına `#### File` olarak eklendi. **Tek model çağrısı** ile geniş review üretilir.

## Kaynak önceliği

1. **`#### Diff`** — changed satırlar; bulgu burada anchor almalı.
2. **`#### File` (role=related)** — read-only doğrulama: caller, entity mapping, join, orphanRemoval, size gate. Okumadan spekülasyon yazma.
3. Skill rubric (requesting-code-review + reviewer template).

Stub skill'deki "Git yok / yalnız diff" **bu modda geçersiz** — local checkout ve CodeGraph context kullan.

## Inline comment bölme

Her Critical / Important / Minor bulguda changed dosyada **`**File:** \`path:line\``** zorunlu. Extension review metnini bu satırlardan Bitbucket inline comment'lere böler.

- **Issue:** / **Why it matters:** / kısa **Suggested code** fenced block ekle.
- Related-only satıra bulgu yazma; diff hunk'ta anchor yoksa bulguyu düşür veya changed satıra taşı.

## Geniş review

Related context ile blast radius, N+1, entity mapping, API contract ve cross-file invariant kontrol et. Yine de diff-first: yalnız PR'ın değiştirdiği satırlarda bulgu üret. Önceki chunk / bridge yok — tüm bulgular bu tek review çıktısında.
