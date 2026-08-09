/**
 * Re-export of the path data model, which lives in `core/geometry/path.ts`.
 *
 * The declarations moved down because `core/scene/types.ts` names `Path` — a
 * scene node's pose can *be* a path — and core may not import from features.
 * This module stays as the address the paths feature and its 45 importers
 * already use.
 */
export {
  PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS,
} from 'core/geometry/path';
export type {
  Path, PolygonPath, RectPath, PathFillRule,
} from 'core/geometry/path';
