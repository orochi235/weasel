---
'@weasel-js/labkit': patch
---

A value an instrument reports with `reportAuto` from an effect of the commit that turns its path back to auto now shows: unpinning a lever whose instrument reports right away read bare `auto`, and the hidden control kept the old pinned value, until something re-reported later. Reporting `null` now withdraws a report as `undefined` does, where it read `auto · None`.
