---
'@weasel-js/ui': patch
---

`useRovingTabIndex` reads far less computed style under jsdom, where `checkVisibility` is missing, so tests rendering roving lists run faster.

Without `checkVisibility` it now checks only the item and the elements between it and the container, so an item in a hidden container keeps the tab stop and Tab can reach it once the container shows again.

<!-- entry: perf fix -->
