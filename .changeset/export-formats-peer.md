---
'@weasel-js/svg': minor
'@weasel-js/pdf': minor
'@weasel-js/diagram-formats': minor
---

svg, pdf and diagram-formats take `@weasel-js/export` as a peer, and the svg and pdf formats register in its registry.

`registerSvgExport()` and `registerPdfExport()` register with `@weasel-js/export`'s registry; the packages' own exports are unchanged. For `@weasel-js/pdf` the peer is optional, as core is: only the `./export` entry reads it.

<!-- entry: api -->
