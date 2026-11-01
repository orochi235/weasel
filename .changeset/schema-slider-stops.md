---
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

A number leaf takes `stops`, the values its slider catches on, declared in the stored unit like `min` and `max`: `pref.number('Level', 0, { min: -1, max: 1, stops: [0] })`, or labkit's `f.number(0).range(-1, 1).stops([0])`. `prefDisplayBounds` converts them with the bounds. Every surface drawing the leaf as a slider honors them, since `PrefsForm`, `SelectionPanel`, `Bar`, `ControlPanel`, and `ControlMatrix` all draw it through `PropertyField`, which takes `stops` too: each stop is marked on the track, a drag passing within the `targets.sliderStopSnapPx` kit setting of one lands on it unless alt is held, and an arrow key stepping across one, on the track or its readout, stops there. Additive.
