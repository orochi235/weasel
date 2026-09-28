---
"@weasel-js/core": patch
---

`@weasel-js/core` now tree-shakes for consumers. Its `dist` is now one file
per source module instead of shared chunks, so importing one symbol ships that
symbol's modules rather than the whole kit: `import { asNodeId }` goes from
about 620 kB minified to under 100 bytes with vite's production bundler.
