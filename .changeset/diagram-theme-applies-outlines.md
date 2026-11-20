---
'@weasel-js/diagram': patch
---

Applying a diagram theme sets outline widths and dashes as building in that theme does, not only colors.

A width or dash an item's `colors` sets is recorded in its trait's new `ownLine` and kept.

<!-- entry: fix visual -->
