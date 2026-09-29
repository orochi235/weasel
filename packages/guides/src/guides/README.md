# guides

User-placed guide lines (the ones you drag off a ruler), plus the alignment
machinery under [`alignment/`](./alignment).

## Guides proper

| File | Role |
| --- | --- |
| `types.ts` | The `Guide` shape. |
| `useGuides.ts` | State: `addGuide` / `removeGuide` / `clearGuides`. |
| `layer.ts` | `createGuidesLayer` — draws them: a guide with a `span` as a ticked segment (`extent: 'full'` for a canvas-long line), one without across the canvas, plus any `SpacingGap`s from `getGaps` with size labels. |

`useGuides` returns **both** a live `guides` array and a stable `getGuides()`
getter. That's not redundancy:

- `guides` is React state — use it to render a guide list in your UI.
- `getGuides()` is the stable getter — pass it to `guideSnapStrategy` and
  `createGuidesLayer`, which are constructed once and run per frame. Handing
  them the array captures whatever existed at construction time and they'll
  never see a guide you add later.

`addGuide` replaces on id collision rather than duplicating, so re-adding a
guide with a known id is an update.

## `alignment/` — the *derived* guides

Same `Guide` type, opposite origin: these aren't placed by the user, they're
computed from the scene while a gesture is in flight. This is the Figma-style
"smart guides" behavior — drag a box near its neighbor's edge and a line snaps
into view.

| File | Role |
| --- | --- |
| `derive.ts` | `deriveAlignmentGuides` — candidate lines from sibling AABBs plus an optional page box. Each box contributes up to 3 guides per axis (two edges + center); overlapping offsets collapse to one candidate, first writer wins for a stable id. |
| `match.ts` | `matchAlignment` — which candidate the dragged bounds is close enough to. `MOVE_ANCHORS`. Poses are read through the caller's `poseDescriptor`. A matched guide's `span` is stretched to reach the snapped box. |
| `spacing.ts` | `measureGaps` / `matchSpacing` — equal spacing: snap a box so its gap to a neighbor in its row or column equals a gap already between two other boxes, or center it between its two neighbors. Returns the equal gaps as `SpacingGap`s to draw. |
| `behaviors.ts` | `alignMoveBehavior` / `alignInsertBehavior` / `alignResizeBehavior` — plugs the above into the move / insert / resize gestures. Given `getSpacingTargets`, move and unrotated resize also snap to equal gaps, the nearer snap winning per axis, and publish them through `setActiveGaps`. |

Because both halves produce `Guide`s, `createGuidesLayer` draws user-placed and
derived guides through the same path — the user can't tell which is which, and
neither can the renderer.

## Related

Snapping to *user-placed* guides during a drag is a snap strategy
(`guideSnapStrategy`, in `../strategies/guides.ts`) and lives outside this module; snapping to *derived*
alignment guides is the `behaviors.ts` above. This module owns guide data and
rendering. Same data-vs-gesture split as [`../grid`](../grid/README.md).
