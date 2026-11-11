---
"@weasel-js/audio": patch
---

`patternVoicePeaks` leaves out an event on a step past the pattern's `length`, or before step 0, which the pattern player never plays, instead of counting voices it would never hold.
