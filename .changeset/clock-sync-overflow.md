---
"@weasel-js/clock": patch
---

A clock's `sync` keeps the playhead finite across two frame times further apart than a double holds, such as `-1e308` then `1e308`. An endless run stops at the largest time it can hold, and a looping clock that far out keeps its place through a duration or loop write.

<!-- entry: rank=-5 fix -->
