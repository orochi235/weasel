---
"@weasel-js/ui": patch
---

`InlineMarkdown` keeps a backslash-escaped mark literal inside strong, emphasis, strikethrough, and a link's label too: `**a\***` reads as a strong `a*`, and `[\]](…)` as a link labeled `]`. An escaped mark there used to close the mark early and leave its backslash showing.
