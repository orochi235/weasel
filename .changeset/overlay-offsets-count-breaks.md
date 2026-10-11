---
'@weasel-js/core': patch
---

Caret offsets in the text edit overlay count the breaks `domToRuns` reads: a `<br>`, and the boundary a `<div>` or `<p>` opens, each as one character. `charOffsetToDomPosition` and `domPositionToCharOffset` counted text nodes alone, so every offset after such an element was short by one per break, and `domToRuns` read no newline at a `<p>`. A position just past a trailing `<br>` comes back as an element and a child index.
