---
'@weasel-js/guides': patch
'@weasel-js/hud': patch
---

Fix gaps in guides' grid, guide and layout helpers, and correct hud docs.

- `createGuidesLayer` now dashes guide lines with its `dash` option, which it used to accept and ignore.
- `pointToGridCell` reads a region with no frame through `origin`, as `gridSnapSource` snaps it, instead of from world zero.
- `useGridCellHover` clears its cell when disabled mid-hover, so a highlight layer no longer keeps drawing the last cell.
- `snapPoint`'s grid pattern offers no points for a zero `gridSpacing` instead of never returning.
- `TextOptions` no longer claims a text widget's bounds follow from its string: they are `fontSize` tall and 0 wide.
