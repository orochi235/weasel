/**
 * Carries (`startCarry`) over the canvas: the element registers as a carry
 * surface, and each step of a carry over it is dispatched as a `carry` event.
 */
import { addCarrySurface, type CarryPointer, type CarryStage } from '../../carry/carry';
import type { DispatchCore } from '../dispatchCore';
import { carryGestureId } from '../gestureIds';
import type { InputEvent } from '../matcher';
import { underPointer } from '../underPointer';

export function carryInput(core: DispatchCore): () => void {
  const { canvas } = core;
  if (!canvas) return () => {};
  // The view each pointer's carry came over in: the handle it started lives
  // on that view's dispatcher, so its moves and its release go there too.
  const pinned = new Map<number, string | null>();

  return addCarrySurface({
    element: canvas,
    receive(stage: CarryStage, payload, at: CarryPointer, pointerId) {
      if (core.disposed()) return 'unhandled';
      // Built in the view routed at the time, which places it and classifies what is under it.
      const event = (): InputEvent => {
        const w = core.toWorld(at.clientX, at.clientY);
        const { affordance, bodyTarget, bodyKind } = underPointer(core.target(), at, w);
        return {
          kind: 'carry', stage, pointerId, type: payload.type, value: payload.value,
          x: w.x, y: w.y, clientX: at.clientX, clientY: at.clientY,
          altKey: at.altKey, ctrlKey: at.ctrlKey, metaKey: at.metaKey, shiftKey: at.shiftKey,
          ...(affordance !== undefined ? { affordance } : {}),
          ...(bodyTarget !== undefined ? { bodyTarget } : {}),
          ...(bodyKind !== undefined ? { bodyKind } : {}),
        };
      };
      const routedNow = core.routedView();
      try {
        if (stage === 'enter') {
          core.routeAt(null, at.clientX, at.clientY);
          pinned.set(pointerId, core.routedView());
          return core.dispatch(event());
        }
        if (pinned.has(pointerId)) core.setRoutedView(pinned.get(pointerId)!);
        if (stage === 'drop' || stage === 'leave') pinned.delete(pointerId);
        if (stage !== 'leave' && !core.dispatcherNow().inFlight().has(carryGestureId(pointerId))) {
          // A move or a release nothing has taken yet is the walk's again, in
          // whichever view it is over; a handle a move starts there keeps it.
          core.routeAt(null, at.clientX, at.clientY);
          if (stage === 'move') pinned.set(pointerId, core.routedView());
        }
        return core.dispatch(event());
      } finally {
        core.setRoutedView(routedNow);
      }
    },
  });
}
