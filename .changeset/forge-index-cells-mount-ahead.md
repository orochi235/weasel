---
'@weasel-js/forge': patch
---

An index page in the workshop mounts a cell a viewport before it scrolls into view. The page sits in a scrolling pane, which clipped the cell and so defeated the margin; cells now use the same position check a trial's story does, and still start unmounted.
