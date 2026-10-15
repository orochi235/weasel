---
'@weasel-js/ui': patch
---

`<Icon mark>` takes sixteen more marks: `markDelete`, `markSort`, `markFilter`, `markUndo`, `markRedo`, `markExport` and `markSnapshot` for the actions that had a full-size glyph and no mark, `markPlay`, `markPause`, `markStop`, `markStepBack` and `markStepForward` for playback, and `markFirst`, `markPrev`, `markNext` and `markLast` for paging. Paging also gets full-size glyphs: `first`, `prev`, `next` and `last`, with `FirstIcon`, `PrevIcon`, `NextIcon` and `LastIcon`.

A marked glyph is now cleared along the mark's own outline, in a band of even width, where it used to be cleared in a circle around the slot.
