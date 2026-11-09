---
"@weasel-js/svg": patch
---

A stylesheet rule using `:nth-child(… of S)` or `:nth-last-child(… of S)` now ranks with S's specificity added to its own, as CSS Selectors 4 has it, so it wins over the rules it should.
