---
'@weasel-js/text': minor
'@weasel-js/text-dom': patch
---

`styleAtRange` takes the node's style and paint, and a range whose runs all render the same reads as that value rather than mixed.

Pass `{ style, paint }` as a fourth argument: runs that leave `italic` to an italic node beside runs that set `italic: true` read `italic: true`, and the same holds for a `fontFamily`, a `fontSize` or a `fontWeight` equal to the node's. `useTextEdit` reads its `rangeStyle` and `effectiveStyle` this way, so Italic shows on, and Cmd+I turns it off, across such a selection.

<!-- entry: fix api -->
