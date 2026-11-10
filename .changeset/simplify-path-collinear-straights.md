---
"@weasel-js/geom": patch
---

`simplifyPath` folds short straight pieces that run in line with a long straight into it, instead of keeping an anchor at each end of the long piece. `offsetPath` (`@weasel-js/stroke`) refits its result through it, so a mitered offset of a shape whose sides are not axis-aligned (a triangle, a square on its corner) came back with extra anchors partway along its sides: twelve for a square standing on a corner. It now answers one anchor per corner.
