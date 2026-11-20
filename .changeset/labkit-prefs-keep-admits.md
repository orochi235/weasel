---
'@weasel-js/labkit': patch
---

A config schema's admitted selectors survive `prefsFromConfig` and `f.prefs`, so its `.per()` scopes still name a selector the schema admits.

<!-- entry: fix -->
