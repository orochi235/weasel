---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Adds: a No fill chip beside the character strip's Color field. On, it sends `{ fill: null }` through `CharacterOptions`' `onPatch`, so it unfills the selected range, or arms no fill for the next character at a caret. It is lit over a range whose fill is `null` and over an unfilled node's, which `effectiveRangeStyle` reports as no `fill` at all, and unlit over a mixed range.

Adds API: `useTextTool.options` gains a `noFill` leaf, the one key of that group that is not a `StyledRun` field. A host drawing the group itself maps it to `fill: null`.

Fixes: `CharacterOptions` threw on a range style whose `fill` was `null`.

Two calls here were made on an agent's judgment and no browser has drawn the chip. Turning it off fills the range with the color the Color field shows beside it, which is that leaf's default (`#000000`) while the range is unfilled, where taking the run's fill off would do nothing over an unfilled node. And the chip is a leaf of the tool's options, drawn by the bar as the Bold and Italic toggles are, with the `paintNone` glyph.
