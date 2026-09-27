---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

Drops the fallback values kit stylesheets carried on theme tokens. Every theme declares those tokens, so the fallbacks never applied; several were stale colors from an earlier palette. Nothing renders differently.
