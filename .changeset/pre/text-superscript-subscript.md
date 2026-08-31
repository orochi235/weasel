---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Superscript, subscript and overline for styled runs

`StyledRun` gains `script: 'super' | 'sub'` — a raised or lowered baseline and
a smaller size together, the pair `<sup>` and `<sub>` imply. It is a preset
over two new primitives rather than a mechanism of its own:

- `baselineShift` — raise (positive) or lower (negative) a run off the line's
  shared baseline, in ems of the inherited font size.
- `fontScale` — a multiplier on the inherited font size, the relative
  counterpart to `fontSize`. An absolute `fontSize` still wins over it.

Naming either directly overrides that half of `script` and leaves the other
alone. The preset's numbers are exported as `SCRIPT_METRICS` (58.3% size,
±33.3% position — Adobe's defaults, so a character panel can show percentages
its users already recognize) and are derived, not read from the font: `OS/2`
carries real `ySuperscript*` metrics but the baked atlas tier has no slot for
them, and metrics that applied on one glyph tier and not the other would
reflow text as it crossed the size threshold.

`resolveRuns` folds all of it into one world-unit `baselineShift` and a final
`fontSize`, so layout never learns superscripts exist — it places a run against
a baseline and an offset. The shift moves a run's glyphs, its outline geometry
and its own decoration rules together, and deliberately does not feed back into
the line's baseline or height: a superscript rides the line rather than
reflowing it.

`overline` joins `underline` and `strikethrough` on both `TextStyle` and
`StyledRun`, additive over the node style like the other two, and is now
available to a custom `RunGrammar` as a `RunFlag`. The default markdown grammar
is unchanged — it stays silent on the decorations, as it always has been.
