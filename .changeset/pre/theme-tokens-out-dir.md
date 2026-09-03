---
'@weasel-js/theme': patch
---

`gen:tokens` honors `WZL_TOKENS_OUT_DIR`, so the determinism check generates
into a temp dir and diffs rather than overwriting `tokens.css`, `themes.ts` and
`manifest.ts` while other tests in the same vitest project are reading them.
