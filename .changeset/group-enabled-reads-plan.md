---
"@weasel-js/core": patch
---

Group is disabled with `NotApplicable` where it cannot run: members on more than one layer, or a container too large for the double range. Its `enabled` and its `run` read one plan. It was enabled for members on two layers while doing nothing, and wrote an infinite container pose for members spanning the double range.
