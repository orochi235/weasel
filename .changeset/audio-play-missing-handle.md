---
'@weasel-js/audio': patch
---

`engine.play(undefined)`, as from a misspelled `loadAll` key, drops the voice as `unready` with a warning.

<!-- entry: fix -->
