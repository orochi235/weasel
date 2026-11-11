---
"@weasel-js/forge": patch
---

`formatRoute` writes a story id holding a lone surrogate as U+FFFD, as it already did for a param's value, rather than throwing `URIError`.

<!-- entry: rank=-5 fix -->
