---
'@weasel-js/ui': patch
---

`Button` gains a `link` variant: a real `<button>` that reads as a hyperlink, for in-page navigation where there is no URL to put in an `<a href>`. It drops the control box — no height, padding, fill or gloss — and takes its font from the surrounding text, so it sits inside a sentence or a table cell at that text's size. The text is painted with `--wzl-accent-fg`, the accent-as-text token.
