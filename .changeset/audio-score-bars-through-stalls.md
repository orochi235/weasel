---
"@weasel-js/audio": patch
---

A score counts its bars from the steps its pattern player has passed, so a stall that skips steps no longer stalls the bar count. A stall past a bar's last step left the next bar unwritten: the score reported the same bar number again, played the bar before's notes, and held a new mood back a bar. A bar whose first steps a stall skipped is now reported at the first step it books, and `cueBar` counts any bars skipped. The pattern player's `onStep` gets a third argument, the steps since `start`, skips included.
