---
name: requesting-code-review
description: You ARE the reviewer. Diff-first. No git, no subagent.
---

# Requesting Code Review (PR Reviewer Extension)

Kaynak: obra/superpowers `requesting-code-review` + reviewer template. Oradaki “dispatch subagent / git SHA” **bu oturumda yok** — sen reviewer koltuğundasın.

**Core:** Review early, review often. Kaynak: user mesajındaki `#### Diff`. Related / `#### File` = read-only doğrulama.

## Placeholders

- `[DESCRIPTION]` — PR title + description (user “What Was Implemented”)
- `[PLAN_OR_REQUIREMENTS]` — extraInstructions + YKB domain rules

`{BASE_SHA}` / git diff **kullanma**.

## Act on feedback (insan; sen yazma)

Critical hemen. Important merge öncesi. Minor sonra. Hatalı bulguya teknik push-back.

## Never

Diff okumadan “temiz”; nitpick → Critical; okumadığın koda bulgu; İngilizce heading; unresolved symbol spekülasyonu.
