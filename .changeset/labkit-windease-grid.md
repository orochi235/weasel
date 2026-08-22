---
'@weasel-js/labkit': patch
---

Tile workspaces with windease instead of CSS grid

`WorkspaceGrid` now renders a `windease` grid zone. The arrangement is
unchanged — windease's `gridStrategy` auto-balances to `ceil(sqrt(n))`
columns, which is what labkit's own `gridDims` computed, verified identical
for 1–16 tiles — but tiles are absolutely positioned at strategy-computed
rects rather than laid out by CSS, and `resizable` gives them draggable,
keyboard-operable seams.

Two breaking bits for anyone importing them: `gridDims` and its `GridDims`
type are gone, and `.lk-workspace-grid` no longer sets the
`--lk-grid-cols` / `--lk-grid-rows` custom properties.

New `WorkspaceGrid` props: `ids` (stable identity per tile — supply it
whenever a tile can be closed from the middle, or panes inherit each other's
dragged extents), `resizable`, `gap`, `padding`, and `viewport` for
environments where nothing measures.

`dist/styles.css` gains windease's baseline stylesheet as a layer. Consumers
import nothing new; the tiles depend on those rules to position at all.
