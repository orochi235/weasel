---
'@weasel-js/diagram-formats': patch
---

A DOT cluster nested in one with its own stroke or font color reads back without them: the writer resets both, the reader takes `""` as unset.

<!-- entry: fix -->
