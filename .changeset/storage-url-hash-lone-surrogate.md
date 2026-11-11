---
"@weasel-js/storage": patch
---

`encodeUrlHash` writes a lone surrogate as U+FFFD, with a warning, instead of throwing a `URIError`.

<!-- entry: rank=-5 fix -->
