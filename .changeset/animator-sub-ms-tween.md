---
"@weasel-js/animator": patch
---

A tween shorter than 1 ms, on its own or on a target, shows the share of its own length that has elapsed. Its voice ran 1 ms long, so a 0.5 ms tween read a quarter of the way at 0.25 ms rather than half.
