/**
 * @weasel-js/core — domain-agnostic 2D scene-graph primitives for React +
 * canvas apps. A scene is a tree of `SceneNode`s; the kit makes no assumption
 * about a node's payload beyond `{ id }`. Pose shape is generic, units are
 * pluggable, and every interaction is wired through a narrow adapter the
 * consumer implements.
 *
 * Non-rect poses (Path, polygon, custom): the kit is generic over `TPose`.
 * Plug in two small projections so the rect-flavored machinery works on any
 * shape:
 *   - `PoseDescriptor<TPose>` — read AABB + remap on resize. Default
 *     `AUTO_POSE_DESCRIPTOR`, which handles both `{x,y,width,height}` and
 *     `Path`. Pass via `<SceneCanvas poseDescriptor>`.
 *   - `OriginProjection<TPose>` — read snap-origin + translate by delta.
 *     Defaults to `AUTO_ORIGIN_PROJECTION`, which reads rects and `Path`s
 *     alike. Pass via `snap(strategy, { origin })` or
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
export * from './barrel/snap';
export type { CoreKitTargetSettings, GestureKitSettings, ViewKitSettings } from './kitSettings';
export { coreKitSettingsSchema } from './kitSettingsSchema';
// Both the tools star and the paths barrel export this name; saying which settles it.
export type { PenAnchor } from './barrel/paths';
