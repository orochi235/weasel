---
'@weasel-js/paint': patch
---

`parsesAsColor` turns away a value no color could be, such as a long run of brackets that overflowed jsdom's CSS parser.

A value holding brackets, braces, or semicolons, or nesting parentheses more than 16 deep, is answered `false` without asking `CSS.supports`.

<!-- entry: fix -->
