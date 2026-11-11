---
"@weasel-js/font": patch
---

`warmFonts` waits on the atlas loads of the families it names and no others. It found a family's loads by the
prefix `family|`, so warming `a` also waited on a family named `a|400`, and rejected when that one's atlas failed.
