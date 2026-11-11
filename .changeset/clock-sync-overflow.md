---
"@weasel-js/clock": patch
---

`sync` keeps the playhead finite across two frame times further apart than the double range holds, such as `-1e308` then `1e308`. The gap overflowed to `Infinity`, which left an endless clock's `elapsed` at `Infinity` and made a ramp to rest `NaN`. The gap is now held to the largest double, and an endless run stops at the largest time it can hold.
