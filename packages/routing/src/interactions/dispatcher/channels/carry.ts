/**
 * Carries (`startCarry`) over the canvas: the element registers as a carry
 * surface, and each step of a carry over it is dispatched as a `carry` event.
 */
import { addCarrySurface, type CarryPointer, type CarryStage } from '../../carry/carry';
import type { DispatchCore } from '../dispatchCore';
import { gestureIdFor } from '../gestureIds';
import type { InputEvent } from '../matcher';

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
      const event = (): InputEvent => {
        const w = core.toWorld(at.clientX, at.clientY);
        return {
          kind: 'carry', stage, pointerId, type: payload.type, value: payload.value,
          x: w.x, y: w.y, clientX: at.clientX, clientY: at.clientY,
          altKey: at.altKey, ctrlKey: at.ctrlKey, metaKey: at.metaKey, shiftKey: at.shiftKey,
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
        if (stage !== 'move') pinned.delete(pointerId);
        const ev = event();
        // A release nothing took as the carry came over is the walk's again,
        // in whichever view it landed in.
        if (stage === 'drop' && !core.dispatcherNow().inFlight().has(gestureIdFor(ev))) {
          core.routeAt(null, at.clientX, at.clientY);
          return core.dispatch(event());
        }
        return core.dispatch(ev);
      } finally {
        core.setRoutedView(routedNow);
      }
    },
  });
}
