---
"@weasel-js/geom": patch
"@weasel-js/path-tools": patch
---

`extendToMeet` no longer reports a meet from an end that already touches a stroke. An end left on a stroke by an earlier extension sits a float32 rounding off it, and Extend to next path used to "carry it on" by a millionth of a unit: enabled, an undo step recorded, and nothing visibly changed.
