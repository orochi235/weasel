---
'@weasel-js/quantity': patch
---

Several display kinds could not read back the text they show. `currency` failed in any locale whose currency abbreviation ends in a period (`12,50 kr.` in `da-DK`, `12,50 лв.` in `bg-BG`) and in `ar-EG`, and dropped a typed magnitude suffix, so `$5k` read as 5. `percent` failed where the sign is `٪`, is wrapped in bidi marks (`ar`, `ar-EG`, `fa-IR`), or sits inside the minus (`−%50` in `tr-TR`). `multiplier({ symbol })` could not read its own symbol. `parseAs` now reads all of these.
