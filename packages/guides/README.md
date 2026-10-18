# @weasel-js/guides

Placement aids for weasel: a visible grid and snapping to it, guide lines and
alignment to sibling edges, and the layout strategies a container arranges its
children with.

Everything here plugs into a seam `@weasel-js/core` already has. A snap
strategy is a `SnapStrategy`, the select tool's `snap` option takes one, and
core's `snap()` turns one into a move behavior. The move, resize and insert
behaviors go in the actions' `behaviors` lists. The grid and guide overlays are
`RenderLayer`s for a canvas layer slot, and a layout strategy implements core's
`LayoutStrategy`.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/guides).

## Install

```sh
npm install @weasel-js/guides
```

## Usage

A grid you can see and snap to:

```tsx
import { SceneCanvas, type RectPose } from '@weasel-js/core';
import { createGridLayer, gridSnapStrategy } from '@weasel-js/guides';

const grid = createGridLayer({ spacing: 20, bounds: () => ({ x: 0, y: 0, width: 800, height: 600 }) });

<SceneCanvas
  /* … */
  selectTool={{ snap: gridSnapStrategy<RectPose>(20) }}
  layers={{ grid: { layer: grid } }}
/>;
```

`snapToGrid` and `snapToGuides` exist for move, resize and insert, and each
has the shape its action expects, so they are imported from a per-action
subpath:

```ts
import { snapToGrid } from '@weasel-js/guides/move';
import { snapToGrid, pointSnapToGrid } from '@weasel-js/guides/resize';
import { snapToGrid } from '@weasel-js/guides/insert';
```

| Area | Exports |
|---|---|
| Grid | `createGridLayer`, `createCellHighlightLayer`, `useGridCellHover`, `gridSnapStrategy`, `pointToGridCell`, `pointSnapToGrid`, `roundToCell` |
| Guides | `useGuides`, `createGuidesLayer`, `guideSnapStrategy`, `deriveAlignmentGuides`, `matchAlignment`, `alignMoveBehavior`, `alignResizeBehavior`, `alignInsertBehavior` |
| Snap sources | `gridSnapSource`, `guideSnapSource`, `alignmentSnapSource`, `spacingSnapSource`, for `<SceneCanvas snap={{ sources }}>` or a preset's `snapSources` |
| Spacing hints | `createSpacingHintsPreset` (below), `distanceReadout`, `measureDistances` |
| Layout | `freeform`, `tileGrid`, `snapPoint`, `slots` (with the `rowSlots`, `gridSlots`, and `ringSlots` arrangements), `pack`, `quadtree`, `perContainer` for a strategy that keeps state, and the drop-target pickers `none`, `nearest`, `nearestWithin`, `containedThenNearest`, `cellAt` |

Spacing hints are one `<SceneCanvas features>` preset: its snap sources move
the selection to the spacing between its siblings (and, with `align`, to their
edges and centers), the canvas's snap readout marks the equal gaps, and holding
Alt over a shape measures its distance from the selection. It lives in
`src/spacingHints/`.

```tsx
const spacingHints = useMemo(() => createSpacingHintsPreset({ color: '#e0397f' }), []);

<SceneCanvas /* … */ features={['draw', spacingHints]} />;
```

## License

MIT
