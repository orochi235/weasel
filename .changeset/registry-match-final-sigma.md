---
"@weasel-js/registry": patch
---

`matchQuery` finds a Greek text that holds the query exactly when the match ends in a capital sigma: `Σ` lowercases to `ς` at the end of a word and `σ` elsewhere, so `'ΑΣ'` missed the query `'Σ'`. Both sigmas now match each other.
