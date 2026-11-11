---
"@weasel-js/core": patch
"@weasel-js/diagram-formats": patch
---

`addPage` and `addTemplatePage` place a page whose `index` lies past either end of the page order at that end, as `movePage` does. A negative `index` no longer counts from the end, so `index: -1` puts the page first.

<!-- entry: fix -->
