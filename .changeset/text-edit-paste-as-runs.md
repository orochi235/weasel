---
'@weasel-js/text-dom': patch
---

Changes: `useTextEdit` reads a paste or a drop into runs and writes it through them, where the browser used to insert the clipboard's markup into the overlay. Measured in headless Chromium, a paragraph, a list, and a table copied from a page landed as `<span>`, `<ul>`, and `<table>` elements carrying the page's face, size, and color, and the list and the table read back with no line breaks between their items. Now a block opens and closes a line, a table cell follows the one before it after a tab, white space collapses as the source drew it, and the overlay holds only run spans afterward. A paste with no markup goes in as its plain text, a CRLF as one line feed.

Behavior change, made on an agent's judgment where the TODO entry left it open between plain text only and keeping the markup's styling: pasted text keeps its emphasis (bold, italic, underline, strikethrough, overline, super- and subscript) and takes face, size, color, and spacing from the run it lands in, with any armed style applied. A browser writes each copied element's computed face, size, and color into the clipboard, the source page's defaults included, so those cannot be told apart from styling someone chose. This also means copying a colored run out of the overlay and pasting it back keeps its emphasis and loses the color, which the browser's own insertion kept.

An engine whose `beforeinput` carries no `dataTransfer` still inserts for itself. The paste rewrites the overlay's spans, as a styling change does, so the browser's own undo is not expected to step back over it; that was not measured.
