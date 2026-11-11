---
"@weasel-js/plot": patch
---

`ordinalScale` and `bandScale` keep a key their domain names twice at its first place, listed once. An ordinal scale used to list the key twice in `ticks()` and map it to its second value, skipping one; a band scale drew a second band for it that `start` and `position` reached in place of the first.
