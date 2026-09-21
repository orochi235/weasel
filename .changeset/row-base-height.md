---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

Every property row stands on the same floor.

A row was as tall as whatever it held — 16px around a switch, 20 around a
field, 24 around a `<Select>` — so a column of mixed rows set its own line
spacing row by row and read as ragged. `.row` now carries a `min-height` of
`--wzl-prop-row-h`, which defaults to the panel's own field height and so
follows `density`. Taller content still grows its row; this only stops a short
one from collapsing beside the field it sits next to.

Three field-family controls were reading a standalone control's height token
rather than the panel's, and overshot or undershot the rows around them:

- A kit `<Select>` in a row took `--wzl-control-h` (24px at the default
  density, against a 20px field). Its trigger now reads `--wzl-select-h`, a new
  hook defaulting to `--wzl-control-h`, which the property list points at the
  field height.
- A segmented `ToggleRow`'s buttons were a hard-coded 26px, and did not move
  with `density` at all.
- A slider row's readout was pinned to `--wzl-control-h-sm`, so a `tight` panel
  kept comfortable-sized readouts.
