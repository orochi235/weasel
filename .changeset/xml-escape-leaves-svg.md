---
'@weasel-js/svg': major
'@weasel-js/registry': minor
---

`escapeAttr` and `escapeText` move from `@weasel-js/svg` to `@weasel-js/registry`, with `holdsNonXmlChar` beside them.

This is breaking: import them from `@weasel-js/registry`. They escape the same.

<!-- entry: breaking api -->
