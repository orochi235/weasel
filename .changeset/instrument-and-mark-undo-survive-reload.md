---
"@weasel-js/labkit": patch
---

Undo and Redo over an instrument's history and over a trial's marks survive a reload, in the order the steps were made.

`TrialHistorySource` gains two optional methods: `serialize()`, whose result the trial saves in its record beside its state, and `restore(data, rebuild)`, which the trial calls once per load of its record, handing `rebuild` to make live ops again of the settings entries it recorded onto that history. A history without them starts empty on every load, as before.

`sceneTrialHistory` implements both, so a `<TrialSceneCanvas>` trial keeps its scene's undo. Its `stamps` argument is now a `Map`.

A mark set's `toJSON` carries the marks' history as `history`, so marks an instrument keeps in its own `storage` keep theirs as well; a mark set saved without one opens with nothing to undo, and a cloned trial's marks start with none. `MarkHistory` gains `toJSON()` and `fromJSON()`.

<!-- entry: rank=10 breaking new api data -->
