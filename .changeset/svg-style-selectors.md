---
'@weasel-js/svg': patch
---

`parseSvg` now reads `<style>` elements. Rules match by class, id, type, attribute, descendant and child combinators, and comma lists, and resolve by CSS precedence: presentation attributes lowest, then stylesheet rules by specificity and source order, then `style=""`, with `!important` inverting per CSS Cascade 4. Illustrator-style exports (`<style>.cls-1{fill:#f00}</style>` with `class` attributes) now import with their paint. `style=""` goes through the same declaration parser, so `!important` works there too, and gradient stops honor `stop-color` / `stop-opacity` from `style=""` and stylesheet rules. At-rules (`@media`, `@supports`, `@import`, `@font-face`, …) are skipped, and a `<style>` is no longer reported as an unsupported element.
