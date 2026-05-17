import { useMemo, useRef } from 'react';
import { defineTool } from '../../routing';
import type { Tool } from '../../types';
import type { InsertAdapter } from 'core/adapters/types';
import type { View } from 'core/viewport/view';
import type { CloneBehavior, CloneLayer, ModifierState } from 'interactions/gestures/types';
import type { HotkeyTrigger } from '../../types';
import type { DrawCommand } from '../../../renderer';

/** Vestigial overlay item shape — kept exported for backward compatibility
 *  with the pre-14e Task 3 `drawGhost` option signature. The dispatcher-path
 *  `cloneAction` publishes full poses via `previewIds`/`previewPose`, which
 *  the canvas preview-ghost layer renders via the scene slot's `drawOne`,
 *  so this shape is no longer in the runtime path. */
export interface CloneOverlayItem {
  id: string;
  x: number;
  y: number;
}

/** Vestigial scratch shape — kept exported for backward compatibility with
 *  the pre-14e Task 3 `Tool<CloneScratch>` surface. The dispatcher path
 *  parks pending state inside `cloneAction`; the runtime scratch is null. */
export interface CloneScratch {
  pendingId: string | null;
  pendingMods: ModifierState | null;
}

export interface UseCloneToolOptions<T extends { id: string } = { id: string }, TPose = unknown> {
  /** Clone behaviors (e.g. `cloneByAltDrag()`). Today these are read by
   *  consumers wiring `cloneAction` — the dispatcher-path action reads
   *  behaviors from its own option surface. Retained on the tool's option
   *  type so the public surface keeps its shape for callers that pass
   *  them through. */
  behaviors: CloneBehavior[];
  /** Hit-test the world point and return the topmost cloneable id, or null.
   *  Pre-14e Task 3 this drove the tool's pointerDown classifier; after
   *  removal, the dispatcher's `affordanceAt` + selected-body classification
   *  drives the gesture. Retained for option-surface compat. */
  pickBest?: (worldX: number, worldY: number) => string | null;
  /** Pre-14e ghost-draw callback. The preview-ghost layer now renders
   *  clones via the scene slot's `drawOne`; this option is no longer in
   *  the runtime path. */
  drawGhost?: (items: CloneOverlayItem[], view: View) => DrawCommand[];
  /** Pre-14e ghost-draw fallback. Same — runtime no-op. */
  drawOne?: (obj: T, pose: TPose, view: View) => DrawCommand[];
  /** CloneLayer category. Pre-14e forwarded to `useClone`; after removal,
   *  the dispatcher-path action owns layer selection. */
  layer?: CloneLayer;
  /** Optional id-list expansion. Pre-14e forwarded to `useClone`. */
  expandIds?: (ids: string[]) => string[];
  /** Tool id. Default `'clone'`. */
  id?: string;
  /** Cursor while the activating modifier is held. Default `'copy'`. */
  cursor?: string;
  /** When true, alt-drag clones the entire selection if the hit id is in
   *  the selection; otherwise clones just the hit. Behavior owned by the
   *  dispatcher-path action now. */
  cloneSelection?: boolean;
  /** Hotkey trigger that engages the tool. Default `'alt'`. */
  hotkey?: HotkeyTrigger | null;
}

/** Wraps the dispatcher-path `cloneAction` as a Tool record. The tool sits
 *  in the ambient slot (or wherever the consumer puts it) and declares a
 *  single drag binding for `kind: 'drag'` on `selected-body` with `alt: true`,
 *  which the dispatcher routes to the `clone` action.
 *
 *  Phase 14e Task 3: legacy `useClone` hook removed. All gesture state,
 *  preview poses, and the commit-on-end clone insertion live in
 *  `cloneAction` (see `src/interactions/actions/defaults/clone.ts`). The
 *  canvas preview-ghost layer renders the clone ghost via the scene
 *  slot's `drawOne`; the bespoke `drawGhost`/`drawOne` fallback that
 *  used to live here is gone. */
export function useCloneTool<T extends { id: string }, _TPose = unknown>(
  _adapter: InsertAdapter<T>,
  options: UseCloneToolOptions<T, _TPose>,
): Tool<CloneScratch> {
  const optsRef = useRef(options);
  optsRef.current = options;

  return useMemo(() => {
    const hotkey = optsRef.current.hotkey === null
      ? undefined
      : (optsRef.current.hotkey ?? 'alt');
    return defineTool<CloneScratch>({
      id: optsRef.current.id ?? 'clone',
      cursor: optsRef.current.cursor ?? 'copy',
      presentation: { label: 'Clone (Alt-drag)', group: 'select' },
      ...(hotkey ? { hotkey } : {}),
      // Declarative binding routes alt-drag on a selected body through
      // `cloneAction`. The dispatcher handles selection-hit classification
      // and modifier matching; the tool no longer runs its own pickBest.
      bindings: [
        {
          spec: { kind: 'drag', target: 'selected-body', mods: { alt: true } },
          actionId: 'clone',
        },
      ],
      initial: {},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
