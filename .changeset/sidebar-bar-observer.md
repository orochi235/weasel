---
"@weasel-js/labkit": patch
---

A lab with sidebar sections no longer raises "ResizeObserver loop completed with undelivered
notifications" as it loads. The sidebar watched one section bar for its height and kept watching
it after windease remounted the panel holding it; each bar is now watched from mount to removal.
