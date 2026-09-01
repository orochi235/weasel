---
"@weasel-js/core": patch
---

Add an editor surface for superscript, subscript and overline.

`StyledRun.script`, `baselineShift`, `fontScale` and `overline` reached layout,
SVG and the DOM overlay but nothing could apply them. The character bar now
carries an x² / x₂ pair, an overline toggle beside B / I / U / S, and the two
primitives `script` presets — baseline shift and scale — as percentage fields
that show what the preset supplies and override just that half when typed over.
`overline` also joins the sidebar's node-level Character group. Superscript and
subscript take Cmd+Shift+= and Cmd+Shift+-; the unshifted pair is browser zoom,
which a page cannot cancel.

A styling written at a collapsed caret now arms `useTextEdit`'s new
`pendingStyle` and applies to the next character typed, instead of being
dropped or restyling the whole node. That is what `script` needs — it has no
node-level counterpart to write to by design — and it makes the bar agree with
Cmd+B, which already behaved this way. `rangeStyle` reports the styling *at* a
collapsed caret rather than `{}`, and `toggleStyle` is public.

Three fixes fall out of putting both paths through one implementation:
lowering a flag the node sets now works from the bar and from a collapsed
caret, not only from the keyboard over a range; a toggle reads the node's flags
as well as the runs, so Cmd+B inside a `fontWeight: 700` node clears bold
instead of adding it; and focus returns to the text after a styling control is
clicked, so typing continues in the document rather than reaching the app as
tool shortcuts.
