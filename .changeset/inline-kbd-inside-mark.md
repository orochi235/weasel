---
'@weasel-js/ui': patch
---

`InlineMarkdown` keeps a `<kbd>` shortcut whole inside emphasis or a link label, so a key such as `]` or `*` in it no longer ends the mark.

<!-- entry: fix -->
