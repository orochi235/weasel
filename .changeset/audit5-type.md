---
"@weasel-js/bidi": patch
"@weasel-js/font": patch
"@weasel-js/text-dom": patch
---

Type fixes from an audit:

- The text edit overlay waits for, and sets, a run's own family in the node's weight and style when the run names no weight or style of its own. It asked for 400 normal, so an edit in a bold node could show before its face had loaded.
- `fontHold: 0` shows the edit overlay at once, as documented; it stayed transparent until a zero-length timer fired.
- A numeric `startEdit` caret is placed by the same offset rules as every other selection in the overlay.
- `unregisterCanvasFont` drops the family's glyphs still waiting to bake, so they no longer take atlas room.
- Bidi reordering is linear in the number of tabs and separators on a line; it was quadratic.
