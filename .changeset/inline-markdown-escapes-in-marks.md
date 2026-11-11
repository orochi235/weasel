---
"@weasel-js/ui": patch
---

`InlineMarkdown` keeps a backslash-escaped mark literal inside strong, emphasis, strikethrough and link labels. `**a\***` reads as a strong `a*`, and `[\]](…)` as a link labeled `]`.

<!-- entry: fix -->
