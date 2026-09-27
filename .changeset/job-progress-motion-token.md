---
"@weasel-js/labkit": patch
---

JobProgress's fill animates over `--wzl-motion-fast` rather than a literal 120ms, so a theme that retimes its motion retimes the bar with it.
