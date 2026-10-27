import type { NodeId } from '@weasel-js/routing';
import type { PoseComposition } from './composeFrame';
import type { LayoutFrame } from './layoutTypes';
import type { SystemLayerSpec } from './layerTypes';
import type { AddNodeSpec, RectPose, RegisteredOp, SceneRegistry } from './types';

/** Options for `useScene` — the layers the scene has, what it starts out
 *  holding, and how its history behaves. A scene whose `TPose` is not a
 *  {@link RectPose} has no default composition and must name one. */
export type UseSceneOptions<TData, TLayer extends string, TPose = RectPose> =
  SceneOptions<TData, TLayer, TPose> & NamesComposition<TPose>;

/** `composition` is required unless `TPose` is a rect the default can fold. */
type NamesComposition<TPose> = [TPose] extends [RectPose] ? unknown : { composition: PoseComposition<TPose> };

/** Everything `useScene` takes, with `composition` optional. */
export interface SceneOptions<TData, TLayer extends string, TPose = RectPose> {
  systemLayers: readonly SystemLayerSpec<TLayer>[];
  initial?: readonly AddNodeSpec<TData, TLayer, TPose>[];
  /** The document values the scene starts with, outside history. See `Scene.doc`. */
  doc?: Readonly<Record<string, unknown>>;
  ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
  historyLimit?: number;
  /** Window (ms) within which consecutive same-shaped mutations merge into
   *  the previous undo entry (matching per-op coalesce keys — e.g. repeated
   *  `setPose` on the same node, or repeated `applyBatch` calls whose ops
   *  carry matching `coalesceKey` multisets). `0` (default) disables
   *  coalescing: every mutation is a discrete undo entry. Undo of a
   *  coalesced entry returns to the state before the first merged mutation;
   *  redo restores the latest. `scene.batch` entries never coalesce. */
  coalesceWindowMs?: number;
  generateId?: () => NodeId;
  /** Per-scene registry for non-serializable function fields (clipFromPose, etc.).
   *  Required only when serializing/deserializing scenes that use function fields. */
  registry?: SceneRegistry<TPose, TData, TLayer>;
  /** How a child's pose folds into its container's frame. A stored child pose
   *  is local to the nearest container that defines a frame, and moving a
   *  container writes one pose. Default `RIGID_POSE_COMPOSITION`, which reads
   *  `x`, `y`, `width`, `height`, `rotation` and `transform`; a scene of any
   *  other pose names its own, or `IDENTITY_POSE_COMPOSITION`, under which every
   *  pose is world and a container never carries its children. */
  composition?: PoseComposition<TPose>;
  /** How laid-out containers are measured. See {@link LayoutFrame}. */
  layoutFrame?: LayoutFrame<TPose>;
  /** When supplied, `scene.applyBatch` consults this on every call. If it returns a non-null
   *  `Journal`, ops are routed to the journal's `applyBatch` instead of recording a new
   *  parent-history entry, and undo and redo step that journal. The scene state changes as
   *  normal; only the history tracking differs.
   *
   *  When the accessor isn't known at scene-construction time, wire it after
   *  construction via `scene.setActiveJournalAccessor(fn)`. */
  getActiveJournal?: () => import('@weasel-js/history').Journal | null;
  /** Re-render the host on every scene mutation. Default `true`. Set `false`
   *  when the scene is read by a frame loop rather than by a render — a game
   *  loop, a simulation — and nothing in the host's DOM derives from it.
   *  Read by `useScene`; `createScene` ignores it. */
  subscribe?: boolean;
}
