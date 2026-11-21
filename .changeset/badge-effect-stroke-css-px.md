---
'@weasel-js/ui': patch
---

A Badge `outline` effect's `width`, and the `aqua` and `metal` effects' `bezelWidth` and `rimWidth`, draw that many CSS px. On a badge whose shorter side was under 100 px they had drawn thicker, by 100 over that side: a 30 px tall badge drew a 1 px outline 3.3 px wide.

<!-- entry: fix visual -->
