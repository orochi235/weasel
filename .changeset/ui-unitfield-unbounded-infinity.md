---
"@weasel-js/ui": patch
---

`UnitField` no longer commits or sends live an infinity typed into a field with no `endless` end and no bound to clamp it; the text reverts as any other it cannot hold does.
