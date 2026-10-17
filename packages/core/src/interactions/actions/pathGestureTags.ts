/**
 * @experimental
 * The tags a path operation carries: `path` on every one, and one more naming
 * the gesture family that drives it, so operations sharing a gesture can be
 * gathered (`actionsTagged`) into one tool's variants. The families are the
 * sections of `docs/path-operations.md`.
 */
export const PATH_GESTURE_TAGS = {
  /** Every path operation. */
  path: 'path',
  /** A drag on a path's own anchors, handles, or segments, in path edit. */
  drag: 'path-drag',
  /** A click on a path. */
  click: 'path-click',
  /** A brush stroke over a path. */
  brush: 'path-brush',
  /** Handles on the box around the selected paths. */
  box: 'path-box',
  /** A command run on the selection. */
  command: 'path-command',
} as const;

/** @experimental A gesture family of {@link PATH_GESTURE_TAGS}. */
export type PathGestureFamily = Exclude<keyof typeof PATH_GESTURE_TAGS, 'path'>;

/** @experimental The tags of a path operation in `family`. */
export function pathOperationTags(family: PathGestureFamily): readonly string[] {
  return [PATH_GESTURE_TAGS.path, PATH_GESTURE_TAGS[family]];
}
