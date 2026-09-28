---
"@weasel-js/core": patch
---

`@weasel-js/core` now tree-shakes for consumers. Its `dist` is now one file
per source module instead of shared chunks, so importing one symbol ships that
symbol's modules rather than the whole kit: `import { asNodeId }` goes from
about 620 kB minified to about 19 kB. What remains is the mesh-gradient paint,
which registers itself on import and is now listed in `sideEffects` so it stays
available to any consumer of the main entry.
