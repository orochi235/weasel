---
'@weasel-js/ui': patch
---

`inferTokenType` reads every CSS length unit as a `dimension`, so `TokenPanel` gives such a token a number field under Size. That includes `dvw`, `svw`, `lvw`, `vi`, `vb`, `cqi`, `cqb`, `cqmin`, `cqmax`, `cap`, and `ic`.

<!-- entry: fix -->
