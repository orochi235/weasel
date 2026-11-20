---
'@weasel-js/text-shaping': patch
---

A feature setting holding a character outside ASCII, such as `“liga”`, is refused as not an OpenType feature setting.

It no longer reaches HarfBuzz, so a refused setting leaks no WebAssembly memory however often it is retried.

<!-- entry: fix -->
