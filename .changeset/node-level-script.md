---
'@weasel-js/text': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

`TextStyle.script: 'super' | 'sub'` sets a whole text node as a superscript or subscript. It is the default every run inherits, the way `StyledRun.script` is for one run, and a run naming its own script replaces it.

A run shrunk by a relative size (`script` or `fontScale`) now holds its line open at the size it inherited: `ResolvedRun.strutSize` carries that size, and layout measures the line's height and baseline from it. A superscript alone on a line used to collapse the line to the superscript's own size, which contradicted the rule that a shifted run rides its line rather than reflowing it.

The edit overlay shows a node-level script, and now shows a node-level overline, which it had been dropping. The SVG writer puts a node-level script on `<text>` as `baseline-shift`, which the reader already carries onto every run.
