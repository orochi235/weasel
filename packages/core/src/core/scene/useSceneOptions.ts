import type { OutputGrid } from '@weasel-js/geom';
import type { NodeId, ResizeAnchor } from '@weasel-js/routing';
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
  /** When supplied, every recorded edit consults this: `applyBatch`, a direct call such as
   *  `setPose`, a `batch`, and `scene.history`'s `apply`, `applyOps`, `recordEntry` and `seal`.
   *  If it returns a non-null `Journal`, the edit is recorded there instead of as a new
   *  parent-history entry, and undo and redo step that journal. The scene state changes as
   *  normal; only the history tracking differs.
   *
   *  When the accessor isn't known at scene-construction time, wire it after
   *  construction via `scene.setActiveJournalAccessor(fn)`. */
  getActiveJournal?: () => import('@weasel-js/history').Journal | null;
  /** How the scene keeps nodes on the output grid its document holds under
   *  `kit:outputGrid`. See {@link QuantizeRule}. Without a grid it does nothing. */
  quantize?: QuantizeRule<TData, TPose>;
  /** Re-render the host on every scene mutation. Default `true`. Set `false`
   *  when the scene is read by a frame loop rather than by a render — a game
   *  loop, a simulation — and nothing in the host's DOM derives from it.
   *  Read by `useScene`; `createScene` ignores it. */
  subscribe?: boolean;
}

/**
 * How a scene keeps its nodes on an output target's dot grid (`kit:outputGrid`
 * in `scene.doc`), written by the consumer, which switches on node kind.
 *
 * - `stored` answers the values the document holds on the grid, or null when
 *   none change. The scene runs it on every committed write (after every edit
 *   pass, in the same undo entry), over every node when the grid changes, on a
 *   document it constructs or loads, and on a resize's or a move's live
 *   preview, so the release commits the pose the preview showed. It is handed
 *   the node's stored pose, and for a resize the side the drag holds
 *   (`anchor`; absent, the top-left). It must be idempotent: run on its own
 *   output it returns null, or values equal to what it was given. In
 *   development the scene checks and warns.
 * - `drawn` answers where the node is drawn, handed its world pose. Hit-testing,
 *   selection handles and every other reader keep the stored pose; the two
 *   differ by under half a dot.
 */
export interface QuantizeRule<TData, TPose> {
  stored?(
    node: { data: TData; pose: TPose },
    grid: OutputGrid,
    anchor?: ResizeAnchor,
  ): { pose?: TPose; data?: TData } | null;
  drawn?(node: { data: TData; pose: TPose }, grid: OutputGrid): TPose;
}

/** The part of `Scene` that carries its {@link QuantizeRule}. */
export interface SceneQuantize<TData, TPose> {
  /** See {@link SceneOptions.quantize}. */
  readonly quantize?: QuantizeRule<TData, TPose>;
}
