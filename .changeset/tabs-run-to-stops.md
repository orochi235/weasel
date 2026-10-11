---
'@weasel-js/text': patch
---

`layoutRuns` lays a tab out: U+0009 advances to the next tab stop from the start of its line, where it used to go to glyph lookup and come back zero-width or as whatever the canvas measured. Stops are `tabSize` spaces apart (a new layout option, default 8, as CSS `tab-size`), a tab counts toward the width a line wraps by, and a trailing tab hangs past the aligned edge the way a trailing space does.
