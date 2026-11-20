---
'@weasel-js/core': minor
---

`adoptLegacyPages` refuses a `core:pages` value that is not a `PagesDoc`, naming what is wrong.

The scene is left as it was. `pagesDocFault(value)` makes the same check, returning `null` for a readable value.

<!-- entry: fix api data -->
