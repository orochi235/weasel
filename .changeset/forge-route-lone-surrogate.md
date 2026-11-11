---
"@weasel-js/forge": patch
---

`formatRoute` writes a story id holding a lone surrogate as U+FFFD, as a param's value already was, rather than throwing `URIError`.
