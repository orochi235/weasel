---
'@weasel-js/prefs': patch
'@weasel-js/labkit': patch
---

A pref leaf can carry `meta`, the consumer's own data, which the kit keeps and never reads: no settings search matches it. labkit fields set it with `.meta({...})`, merged across calls; it rides the resolved leaf and survives a round trip through prefs.
