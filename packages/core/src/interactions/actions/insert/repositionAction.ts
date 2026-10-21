import { heldKeySpec, type Action, type GestureBinding } from '@weasel-js/routing';
import type { InsertLiveGesture } from './live';

/**
 * Companion to `insertAction`: while its key is held, dragging moves the
 * shape being drawn instead of resizing it; letting go resumes resizing from
 * where the shape now sits. No-op when no insert is in flight.
 */
export const insertRepositionAction: Action = {
  id: 'insert.reposition',
  label: 'Insert — reposition',
  group: 'insert',
  eligible: { capability: 'creates-shapes' },
  invoker: {
    timing: 'ongoing',
    start: (ctx) => {
      const gesture = ctx.deps.insertLive?.gesture as InsertLiveGesture | null | undefined;
      if (!gesture || !gesture.open) return {};
      gesture.repositioning = true;
      return {
        kind: 'insert.reposition',
        onEnd: () => { gesture.repositioning = false; },
      };
    },
  },
  requires: ['insertLive'],
};

/**
 * The binding a shape-drawing tool adds so holding Space mid-draw repositions
 * the shape. Gated to the tool's own engaged phase, so Space between drags is
 * left to the offhand hand tool. Shift and Alt may be down with it, so a
 * constrained or from-center draw can be moved without letting go of them.
 */
export const INSERT_REPOSITION_BINDING: GestureBinding = {
  spec: { ...heldKeySpec(' '), phase: 'engaged' },
  actionId: 'insert.reposition',
  opts: { id: 'insert.reposition.held' },
};
