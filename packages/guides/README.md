# @weasel-js/guides

Placement aids for weasel: a visible grid, ruler guides, the snap sources that
snap to them and to sibling edges and gaps, and the layout strategies a
container arranges its children with.

Everything here plugs into a seam `@weasel-js/core` already has. A snap source
goes in `<SceneCanvas snap={{ sources }}>` or a preset's `snapSources`, and
competes with every other source under core's one ranking rule; see
[Snapping](https://github.com/orochi235/weasel/blob/main/docs/snapping.md). The grid and guide overlays are
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
import { SceneCanvas } from '@weasel-js/core';
import { createGridPreset } from '@weasel-js/guides';

const grid = createGridPreset({ spacing: 20 });

<SceneCanvas /* … */ features={['draw', grid]} />;
```

The preset draws the grid in the `grid` slot and snaps every snapping gesture
to it — move, resize, insert, the pen — and, being a fallback, its snap gives
way on any axis a real target in reach claims. It takes every `createGridLayer`
option, and `snap: false` to draw without snapping. The layer and the snap
source it is built from, `createGridLayer` and `gridSnapSource`, go to
`<SceneCanvas layers>` and `snap.sources` on their own where a canvas wants
only one of them.

| Area | Exports |
|---|---|
| Grid | `createGridPreset`, `createGridLayer`, `createCellHighlightLayer`, `useGridCellHover`, `pointToGridCell`, `roundToCell` |
| Guides | `useGuides`, `createGuidesLayer`, `deriveAlignmentGuides`, `matchSpacing`, `measureGaps`, `siblingBounds`, `worldBoundsOf`, `worldUnionOf` |
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
