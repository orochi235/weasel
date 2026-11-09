---
"@weasel-js/labkit": patch
---

Reset, and loading a snapshot into a trial, now start the undo afresh on a history the instrument handed over with `useTrialHistory` too: the trial calls the new optional `TrialHistorySource.clear()` where the source offers one, and the settings entries it recorded before then write nothing, so Undo can no longer put the old settings back.
