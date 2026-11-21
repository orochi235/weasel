---
'@weasel-js/ui': patch
---

`InlineMarkdown` keeps a code span whole inside emphasis, strong, strikethrough, or a link label, so `` *the `**` operator* `` reads as emphasis around the code.

<!-- entry: fix -->
