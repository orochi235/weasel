---
"@weasel-js/audio": patch
---

`patternVoicePeaks` leaves out events on steps the pattern player never plays: past the pattern's `length`, or before step 0.

<!-- entry: rank=-5 fix -->
