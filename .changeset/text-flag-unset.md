---
"@weasel-js/core": minor
---

A text run can turn off a flag its node sets.

Run-level `bold` / `italic` / `underline` / `strikethrough` are additive over
the node's `TextStyle` — a run turns a flag on, never off. So "select a word
inside an underlined node and hit U" was unrepresentable, and the character bar
could only refuse.

New `setFlagOverRange(runs, style, start, end, key, value)` in
`features/text/runs/flagRange`, exported alongside `nodeHasFlag`. Turning a
flag on, or off in a node that doesn't set it, is the ordinary additive write
and returns the style untouched. Turning it off in a node that *does* set it
clears the node flag and raises it on the runs outside the range: identical
rendered result, expressible edit, and `StyledRun` unchanged — so nothing a
document can already contain changes meaning.

That is the answer to the recorded question of tri-state versus
normalize-on-write, and it is not close. A tri-state run flag cannot cover
`bold` or `italic`: those are booleans on a run but `fontWeight` and
`fontStyle` on the node, so a run's `false` has no node-level boolean to
override. Tri-state fixes two of the four flags; this fixes all four, and
without widening the persisted shape.

One case is declined rather than approximated. `run.bold` resolves to exactly
700 everywhere, so a node at `fontWeight: 900` cannot have its weight pushed
onto its runs without lightening the text that was *not* edited. That returns
`applied: false` and writes nothing; a control should disable rather than
silently downgrade.

`useTextEdit` takes an optional `setStyle(id, style)` for this — the hook could
read the node style but had nowhere to write one back. Omit it and the toggle
declines exactly as it does today.
