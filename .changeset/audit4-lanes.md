---
'@weasel-js/ui': patch
---

The Timeline's lanes show where a nested timeline stops playing: a row inside one shades the stretch past the soonest declared duration around it, and dims the keys and events there, which never play. `LaneRow` carries that time as `end`.
