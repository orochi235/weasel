---
'@weasel-js/svg': patch
---

The SVG parser's text, image, marker, clip-path, paint, and shape readers each move out of `parse.ts` into a module of their own. Nothing it reads or returns changes.
