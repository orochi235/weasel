---
'@weasel-js/font': patch
---

Loading a font whose GPOS lists repeat one long list of lookups no longer hangs: the face kerns from its legacy `kern` table instead.

<!-- entry: fix -->
