---
'@weasel-js/ui': patch
---

A `Tooltip` reads a string child as inline markdown: a backticked span is drawn as `Code`, `**strong**`, `*emphasis*`, and `~~strikethrough~~` as their elements, and a link as its label, since a tooltip takes no interaction. It printed the punctuation. An element child is drawn as given, so `<Tooltip><>{text}</></Tooltip>` keeps a string literal. `PropertyHelp` describes its row to a screen reader with the marks taken off.

Adds `InlineMarkdown`, the component that draws such a line anywhere, with `parseInline(text)` for its tokens and `inlineMarkdownText(text)` for the words alone. An underscore is never emphasis, and a `*` beside a space is left as written.
