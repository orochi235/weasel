---
'@weasel-js/symmetry': patch
---

Add a `wallpaper` symmetry kind, which tiles a group's contents across a lattice. The spec's
`spacing`, `angle`, `rowSpacing`, and `rowAngle` set the lattice, its `extent` is the box around the
center the lattice fills, and its `cell` draws one of the turning or reflecting kinds about every
lattice point, turned `cellAngle` from the lattice. `wallpaperSpec(name, spacing)` gives the fields
for fifteen of the seventeen wallpaper groups, listed in `WALLPAPER_GROUPS`. The guide outlines the
extent, dots the lattice, and adds a handle for the row.

`SymmetryKindDef` loses `group` in favor of `pointGroup`, the copies that keep the center fixed,
which path edits now read. This is a breaking change for code that read `group`.
