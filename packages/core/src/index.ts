/**
 * @weasel-js/core — domain-agnostic 2D scene-graph primitives for React +
 * canvas apps. A scene is a tree of `SceneNode`s; the kit makes no assumption
 * about a node's payload beyond `{ id }`. Pose shape is generic, units are
 * pluggable, and every interaction is wired through a narrow adapter the
 * consumer implements.
 *
 * Surface map (broad strokes — see per-symbol JSDoc for detail):
 *   - View transform & viewport: `ViewTransform`, `worldToScreen`,
 *     `screenToWorld`, `fitZoom`, `useCanvasSize`,
 *     `useAutoCenter`, `zoomAt`,
 *     `wheelHandler`.
 *   - Layer composition: `RenderLayer`, `createChildrenLayer`,
 *     `createSelectionOverlayLayer` and friends, `createTextLayer`,
 *     `createTilePattern`.
 *   - Interactions (gesture hooks): `useTextEdit`, plus `useDragHandle` /
 *     `useDropZone` for ad-hoc pointer drags. Resize and move are
 *     dispatcher-driven via the Actions Registry (`resizeAction` /
 *     `moveAction`) — there's no standalone hook to call.
 *   - Actions: the Actions Registry (`ActionsProvider`, `useStandardActions`,
 *     and the per-action descriptors at `interactions/actions/defaults/`).
 *     Standalone consumer hooks (`useDelete`, `useEscape`, ...) were removed
 *     in favor of the descriptor + dispatcher path.
 *   - Op model & history: `Op`, `createInsertOp` / `createDeleteOp` /
 *     `createTransformOp` / etc., `createHistory`, `applyOps`-style entry
 *     wired by every hook.
 *   - Units: `UnitSystem`, `UnitValue`, `ANGLE_RADIANS`, `IMPERIAL_INCHES`, `METRIC_MM`,
 *     `PIXELS`, `resolveUnit`, `formatUnit`.
 *   - Adapters: `SceneAdapter`, plus narrow per-hook subsets
 *     (`MoveAdapter`, `ResizeAdapter`, `InsertAdapter`, `OrderedAdapter`,
 *     action-specific adapters).
 *
 * Non-rect poses (Path, polygon, custom): the kit is generic over `TPose`.
 * Plug in two small projections so the rect-flavored machinery works on any
 * shape:
 *   - `PoseDescriptor<TPose>` — read AABB + remap on resize. Default
 *     `AUTO_POSE_DESCRIPTOR`, which handles both `{x,y,width,height}` and
 *     `Path`. Pass via `<SceneCanvas poseDescriptor>`.
 *   - `OriginProjection<TPose>` — read snap-origin + translate by delta. Used
 *     by `snap` and `snapBackOrDelete`, and by `@weasel-js/guides`' snap
 *     strategies. All of them default to `AUTO_ORIGIN_PROJECTION`, which reads
 *     rects and `Path`s alike. Pass via `snap(strategy, { origin })` or
 *     `snapBackOrDelete({ ..., origin })`.
 *
 * Placement aids — grids, guides, snapping to them, layout strategies — live
 * in `@weasel-js/guides`, built on the seams here (`SnapStrategy`,
 * `MoveBehavior`, `BoundsConstraint`, `PointSnapBehavior`, `snap`).
 */

// One module per area, each naming what it re-exports. A star is safe here
// because every one is a local module; a sibling package's names are always
// re-exported by name inside them.
export * from './barrel/viewport';
export * from './barrel/input';
export * from './barrel/routing';
export * from './barrel/canvas';
export * from './barrel/chrome';
export * from './barrel/text';
export * from './barrel/paint';
export * from './barrel/scene';
export * from './barrel/paths';
export * from './barrel/interactions';
export * from './barrel/icons';
export * from './barrel/renderer';
// Both the tools star and the paths barrel export this name; saying which settles it.
export type { PenAnchor } from './barrel/paths';
