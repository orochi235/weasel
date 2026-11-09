---
'@weasel-js/ui': patch
'@weasel-js/ui-logic': patch
---

Fixes to palette focus, Select's trigger, parametric action leaves, tiled bars and frame sweeps.

- A `SwatchGrid` (and a palette laid on rings) moves its one tab stop to the swatch focus is on, so Tab leaves the palette from wherever the arrows took it. Before, the stop stayed on the current swatch, and Tab from a swatch before it went to that swatch instead of out of the palette. Focus leaving puts the stop back on the current swatch.
- A `Select` whose chosen option has a `description` (or a disabled one's `disabledReason`) shows only the option's label in its trigger. The note was drawn on a second line inside the trigger and read as part of its name.
- An `action` leaf naming a parametric action by its bare id draws each variant with the variant's own shortcut. The leaf's `shortcut` was shown on every variant's button, though one chord cannot fire them all.
- `tileGrid`'s `corners` rounds a grid of one row shorter than its `columns` only at the corners its items reach: a row at the start no longer rounds its last item's top-right corner, and a centered or end-aligned one no longer rounds its first item's left corners.
- `frames` walks no steps for a zero-length looping run under `passes: 'all'`, and one step for `loop: 0`, where it had stepped on past the run's end until the cap.
- An `EffectList` given two kinds with the same label no longer logs a duplicate-key error.
