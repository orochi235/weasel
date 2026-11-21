---
'@weasel-js/ui': patch
---

A Badge `sunbeams` effect's `gradientStart` and `gradientEnd` run 0 to 1 from corner to corner at any `gradientAngle`. At a diagonal angle the gradient had stopped short of the badge's corners, leaving them fully lit or fully faded.

<!-- entry: fix visual -->
