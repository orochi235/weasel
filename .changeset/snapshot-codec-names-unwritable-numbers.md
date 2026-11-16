---
'@weasel-js/core': major
---

A saved scene, history or document keeps `Infinity`, `-Infinity`, `NaN` and `-0` in its data, rather than reading back `null` and `0`.

`stringifySnapshot`, `encodeSnapshot` and `snapshotReplacer` write each such number by name, as `{ "__num": "Infinity" }`, and `parseSnapshot` and `decodeSnapshot` read it back as the number. A value of yours shaped like that tag is wrapped in `{ "__raw": … }` and reads back as itself. Saves written before this read as they did: a `null` written for one of those numbers stays `null`.

This changes the encoded form. A kit from before this change reads a saved number's tag as the object `{ "__num": "Infinity" }`, so a save written now cannot be opened by an older kit; upgrade every reader before its writers.

<!-- entry: rank=10 breaking data -->
