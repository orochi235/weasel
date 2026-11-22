---
'@weasel-js/svg': patch
---

`parseSvg` keeps the first `dx` value on text whose white space collapses. A pretty-printed `<text dx="10">` keeps its shift, as `dy` already did.

<!-- entry: fix data -->
