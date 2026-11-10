---
'@weasel-js/diagram-formats': patch
---

A Mermaid sequence line ending in a character reference such as `#quot;` or `#lt;` keeps the reference's
semicolon, where it was dropped as the line's own and the text read back as `#quot`. A message the writer ended
with `"`, `<`, `>`, or `#` now reads back as written.
