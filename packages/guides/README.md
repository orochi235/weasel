# @weasel-js/guides

Placement aids for weasel: a visible grid, rulers and the guides dragged off them, the snap sources that
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

`spacing` is a pitch for both axes, or a rule per axis. An axis left out has
no lines, so it neither draws nor snaps:

```ts
createGridPreset({ spacing: { y: 25 } });                                  // slatwall: rows only
createGridPreset({ spacing: { x: { at: [0, 40, 55, 100] }, y: 10 } });     // uneven bays
createGridPreset({ spacing: { x: { pitch: 25.4, offset: 12.7, from: 12.7, to: 600 }, y: 25.4 } });
```

A container can run a grid of its own, which its children snap to in its frame
(from its corner, turned and scaled as it is): pass `gridOf` to the snap source
(or the preset's `snap`), and the same `gridOf` to `sceneGridRegions` for the
layer's `regions`. A node declaring snap anchors (`<SceneCanvas snap={{ anchors }}>`)
lands those on the grid instead of its box, and `gridFit` checks whether a set of
points sits on its crossings.

| Area | Exports |
|---|---|
| Grid | `createGridPreset`, `createGridLayer`, `createCellHighlightLayer`, `useGridCellHover`, `pointToGridCell`, `roundToCell`, `sceneGridRegions`, `gridLines`, `gridFit` |
| Rulers | `createRulers` (below), `rulerTicks`, `rulerFrameAt`, `rulersLayout`; `<Rulers>` in `@weasel-js/ui` draws them |
| Guides | `useGuides`, `createGuidesLayer`, `addGuideOp`, `removeGuideOp`, `replaceGuideOp`, `deriveAlignmentGuides`, `matchSpacing`, `measureGaps`, `siblingBounds`, `worldBoundsOf`, `worldUnionOf` |
| Snap sources | `gridSnapSource`, `guideSnapSource`, `alignmentSnapSource`, `spacingSnapSource`, for `<SceneCanvas snap={{ sources }}>` or a preset's `snapSources` |
| Spacing hints | `createSpacingHintsPreset` (below), `distanceReadout`, `measureDistances` |
| Layout | `freeform`, `tileGrid`, `snapPoint`, `slots` (with the `rowSlots`, `gridSlots`, and `ringSlots` arrangements), `pack`, `quadtree`, `perContainer` for a strategy that keeps state, and the drop-target pickers `none`, `nearest`, `nearestWithin`, `containedThenNearest`, `cellAt` |

Rulers run along the top and left of a 2D view. `createRulers` returns a
contribution for `<SceneCanvas ambient>`, which follows the view and the
pointer and takes the drags: off a ruler to place a guide, on a placed guide to
move it, and back onto a ruler to remove it, each one undo step. `<Rulers>` from
`@weasel-js/ui` draws them over the canvas from the same object. The labeled
step is the one `scaleBar` picks, and the labels read in the unit scopes of the
frame under the pointer, so inside a frame that declares `drawnAt` they show its
true lengths.

```tsx
const { addGuide, removeGuide, getGuides, subscribe } = useGuides();
const rulers = useMemo(
  () => createRulers({ guides: { addGuide, removeGuide, getGuides }, root: { system: IMPERIAL_INCHES } }),
  [addGuide, removeGuide, getGuides],
);
// The guide being moved is drawn by the rulers where it is going.
const guidesLayer = useMemo(
  () => createGuidesLayer({ getGuides: () => rulers.settled(getGuides()), subscribe, extent: 'full' }),
  [rulers, getGuides, subscribe],
);
const snap = useMemo(() => ({ sources: [guideSnapSource({ getGuides })] }), [getGuides]);

<div className="host">
  <SceneCanvas /* … */ ambient={[rulers.contribution]} snap={snap} layers={{ guides: { layer: guidesLayer, after: 'scene' } }} />
  <Rulers rulers={rulers} />
</div>;
```

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
