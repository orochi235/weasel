---
'@weasel-js/core': patch
---

The built-in shape painters and the effects composite program register on first use instead of when their modules load. A consumer's bundler that drops an import kept only for its side effect no longer leaves either registry empty.
