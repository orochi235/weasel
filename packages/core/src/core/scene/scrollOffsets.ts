/**
 * How far each container's content is scrolled: view state, never document.
 *
 * A scroll offset is part of the frame a container gives its children, so the
 * document never moves: a child keeps its stored pose and is shown moved by
 * minus the offset. Only the view-side fold reads it — painting, picking,
 * selection chrome, previews and gestures, through `scrolledFrames` — while
 * the layout pass and every writer that stores a pose fold through the
 * unscrolled frame.
 */
import { createEmitter } from '@weasel-js/registry';
import type { PoseAdapter, PoseComposition, ScrollOffset } from './composeFrame';
import { isDocument } from './documentOf';
import type { NodeId } from './types';

/** The scene's scroll offsets, one per scrolled container. */
export interface ScrollOffsets {
  /** How far `id`'s content is scrolled, or `undefined` when it is not. */
  get(id: NodeId): ScrollOffset | undefined;
  /** Scroll `id`'s content to `offset`. `null`, or an offset of zero on every
   *  axis, unscrolls it. */
  set(id: NodeId, offset: ScrollOffset | null): void;
  /** The scrolled containers. */
  ids(): IterableIterator<NodeId>;
  /** Unscroll everything. */
  clearAll(): void;
  subscribe(listener: () => void): () => void;
  /** Bumped by every change, for a cache keyed on what the view shows. */
  getGeneration(): number;
}

/** The scroll store a `Scene` carries. */
export interface SceneScroll {
  /** How far each container's content is scrolled. Like the selection, view
   *  state shared by every view over the scene: never document content, never
   *  recorded or serialized, and it does not bump the scene's version. */
  readonly scroll: ScrollOffsets;
}

/** Build an empty {@link ScrollOffsets}. */
export function createScrollOffsets(): ScrollOffsets {
  const offsets = new Map<NodeId, ScrollOffset>();
  const listeners = createEmitter();
  let generation = 0;
  const changed = (): void => {
    generation++;
    listeners.emit();
  };
  return {
    get: (id) => offsets.get(id),
    set(id, offset) {
      const held = offsets.get(id);
      if (offset === null || (offset.x === 0 && offset.y === 0 && !offset.z)) {
        if (held === undefined) return;
        offsets.delete(id);
      } else {
        if (held !== undefined && held.x === offset.x && held.y === offset.y && (held.z ?? 0) === (offset.z ?? 0)) return;
        offsets.set(id, { ...offset });
      }
      changed();
    },
    ids: () => offsets.keys(),
    clearAll() {
      if (offsets.size === 0) return;
      offsets.clear();
      changed();
    },
    subscribe: listeners.subscribe,
    getGeneration: () => generation,
  };
}

type Scroll = (frame: never, offset: ScrollOffset) => unknown;
const memos = new WeakMap<Scroll, WeakMap<object, { offset: ScrollOffset; out: unknown }>>();

/** `scroll(frame, offset)`, answering the same object while the frame and the
 *  offset objects are the same: a paint memo keys on the pose a child is
 *  composed to, and an unchanged child in an unscrolled-since container must
 *  keep its key from one walk to the next. */
function memoScroll<TPose>(scroll: (frame: TPose, offset: ScrollOffset) => TPose, frame: TPose, offset: ScrollOffset): TPose {
  if (typeof frame !== 'object' || frame === null) return scroll(frame, offset);
  let byFrame = memos.get(scroll as Scroll);
  if (byFrame === undefined) memos.set(scroll as Scroll, byFrame = new WeakMap());
  const held = byFrame.get(frame);
  if (held !== undefined && held.offset === offset) return held.out as TPose;
  const out = scroll(frame, offset);
  byFrame.set(frame, { offset, out });
  return out;
}

/** What `scrolledFrames` reads of a scene. Partial stand-ins without a
 *  `scroll` store read as unscrolled. */
export interface ScrollSource<TPose> {
  readonly overrides?: unknown;
  readonly scroll?: ScrollOffsets;
  readonly composition?: PoseComposition<TPose>;
}

/**
 * The view-side fold's `PoseAdapter.childFrame` over `scene`: each scrolled
 * container's frame moved by its offset. `undefined` when the scene has no
 * scroll store, its composition cannot scroll, or it is a `documentOf` view,
 * which reads as the document holds it, so a reader skips the step.
 */
export function scrolledFrames<TPose>(
  scene: ScrollSource<TPose>,
): ((id: string, world: TPose) => TPose) | undefined {
  const store = scene.scroll;
  const scroll = scene.composition?.scroll;
  if (store === undefined || scroll === undefined) return undefined;
  if (scene.overrides !== undefined && isDocument(scene as { overrides: unknown })) return undefined;
  return (id, world) => {
    const offset = store.get(id as NodeId);
    return offset === undefined ? world : memoScroll(scroll, world, offset);
  };
}

/** `adapter` read as the view shows it: with `scene`'s scrolled frames as its
 *  `childFrame`. The same adapter when nothing can scroll. */
export function viewPoseAdapter<TPose, A extends PoseAdapter<TPose>>(scene: ScrollSource<TPose>, adapter: A): A {
  const childFrame = scrolledFrames(scene);
  return childFrame === undefined ? adapter : { ...adapter, childFrame };
}
