---
"@weasel-js/geom": patch
---

`simplifyPath` folds short straight pieces running in line with a long straight into it.

`offsetPath` (`@weasel-js/stroke`) refits through it, so a mitered offset of a shape whose sides are not axis-aligned has one anchor per corner.

<!-- entry: fix -->
