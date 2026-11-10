---
"@weasel-js/quantity": patch
---

`endlessTrack` puts its infinity stops on the step grid: a step past a max of 4.1 is 4.2, not 4.199999999999999. A spin key leaving an endless end (Page Down from ∞) now lands on a grid value such as 3.2 rather than 3.199999999999999.
