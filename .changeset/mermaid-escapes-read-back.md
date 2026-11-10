---
'@weasel-js/diagram-formats': patch
---

Mermaid text reads back as it was written in more places: an `&` before a character spelled as an entity (`&&lt;`, `&#`, or `&(` in a mind map) is no longer lost, an architecture diagram's titles are escaped rather than written as markup (a `<br>` in one broke the line), a composite state's title has its entities read, and a block's quoted text may hold the other closer of its brackets (`[/"/]"\]`), and its shape is taken from the nearest closer.
