---
'@weasel-js/ui': patch
---

`KeySequence` takes `inline`, for keys set in a line of prose: the row sits on the text's baseline instead of its bottom edge, and its keys are 4px shorter so they do not push the line apart. A key whose legend is an icon gets the same baseline as one with a letter. `InlineMarkdown` sets its `<kbd>` shortcuts inline.
