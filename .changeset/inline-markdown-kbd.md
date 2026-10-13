---
'@weasel-js/ui': patch
---

`InlineMarkdown` draws `<kbd>Mod+Shift+Z</kbd>` as a `KeySequence`, in the reader's own legend: `Mod` is `⌘` on macOS and `Ctrl` elsewhere. `Tooltip` reads its string children the same way, so a tooltip can name a shortcut. `keySpecsFromChord` is the reading on its own, and `parseInline` returns the span as a `keys` token. Additive.
