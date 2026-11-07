---
'@weasel-js/core': patch
---

A pasted text carrying the weasel clipboard marker but no `nodes` array was claimed by the kit's weasel-JSON handler, which then could not parse it, so the paste did nothing instead of falling through to the next handler. `sniffWeaselClipboardText` now accepts exactly what `parseWeaselClipboardText` does.
