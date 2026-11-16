---
"@weasel-js/svg": patch
---

An SVG exported with embedded faces reads back the family of a face whose name holds a line break or a control character.

The `@font-face` rule writes each such character as a CSS escape, so the document still parses as XML and the rule keeps the name it was given.

<!-- entry: fix data -->
