---
'@weasel-js/ui': patch
---

`PageTabs` calls `onSelect` for Enter or Space on the lit tab, as its docs say, not only for a press on it.

<!-- entry: fix -->
