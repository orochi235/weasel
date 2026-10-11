---
'@weasel-js/core': patch
---

Editing text no longer strips a gradient or pattern fill from its runs. The edit overlay could only say a solid color, so any other run fill was dropped the moment the edit committed; the run's span now carries the fill itself and `domToRuns` hands it back.
