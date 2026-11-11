---
"@weasel-js/core": patch
"@weasel-js/diagram-formats": patch
---

`addPage` and `addTemplatePage` hold an `index` past either end of the page order to that end, as `movePage` does. A negative index used to count from the end, so `index: -1` put the new page before the last one.
