---
'@weasel-js/ui': patch
---

`InlineMarkdown` leaves a line holding two globs, such as `src/*.ts to lib/*.js`, as written. A mark opens before punctuation only after a space or at the start of the line.

<!-- entry: fix -->
