---
'@weasel-js/ui': patch
---

A `ToggleBar`, `ButtonBar`, or `OptionsBar` laid along a curved `Along` now rounds its lit end segment the same way under every alignment and length. Before, a lit first or last segment ended square wherever the row reached the end of its track: under `align: 'start'` or `'end'`, and whenever the row was long enough to scroll. The well also stopped short there, at the track's end rather than one rim past the end segment. The well now always runs one rim past the first and last segment on the track, carried straight on past the track's end if need be, and a lit segment at either end fills its round cap.
