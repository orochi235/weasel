---
'@weasel-js/text-shaping': patch
---

`loadShaper` fetches its WebAssembly from the bundled URL in an Electron renderer with Node integration, as it does in any other web page.

<!-- entry: fix -->
