---
'@weasel-js/text': patch
---

`layoutMarkdown` honors `script`, `fontScale` and `baselineShift`. The
2D-canvas path behind `renderLabel` read a run's absolute `fontSize` and
nothing else, so a superscript laid out and painted at full size on the
baseline. `PositionedRun` now carries a resolved `size` and a per-run `y`,
resolved the way `resolveRuns` resolves them for the GL path — an absolute size
wins over a multiplier, and the rise is measured against the inherited size so
it does not shrink along with the run. The painters read both, so layout and
paint can no longer disagree about a run's size.
