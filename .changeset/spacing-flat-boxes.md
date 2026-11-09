---
"@weasel-js/guides": patch
---

Equal spacing (`matchSpacing`, `measureGaps`, `spacingSnapSource`) counts a box with no extent across the axis, such as a horizontal line, as in the row of any box whose range holds it, so a line between two boxes snaps to their gaps. Boxes with extent still have to share some of it, not merely touch.
