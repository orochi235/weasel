---
'@weasel-js/paint': minor
---

`parsesAsColor` says whether a string is a CSS color: the browser's answer where it has `CSS.supports`, a small parser's otherwise.

A second argument replaces the browser's check, or passes `null` to use only the parser. `var()` and CSS-wide keywords such as `inherit` never count as colors.

<!-- entry: new api -->
