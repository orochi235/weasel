---
'@weasel-js/labkit': patch
---

A history handed over with `useTrialHistory(trialHistoryOf(history))` is saved and restored with the trial, so its undo survives a reload.

Its steps also order against the trial's marks to the fraction of a millisecond, as a scene's do.

<!-- entry: fix -->
