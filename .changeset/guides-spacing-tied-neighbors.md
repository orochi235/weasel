---
"@weasel-js/guides": patch
---

`measureGaps`, and so equal-spacing snapping and its marks, measures a box's gap to every box tied for nearest on its right, such as two boxes stacked in one column beside it. It measured only the one that came first among the targets, so which gap was marked depended on sibling order.
