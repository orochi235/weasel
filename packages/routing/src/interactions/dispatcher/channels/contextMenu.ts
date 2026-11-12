/** The contextmenu channel: a right-click. */
import { eventTaken, takeEvent, type DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import { underPointer } from '../underPointer';

/**
 * `takeNativeHold` answers whether a touch or pen hold is in progress, firing
 * its long-press if that is still pending. A browser that sends `contextmenu`
 * for a hold (Android Chrome) is reporting the same hold the dispatcher times,
 * so the event stands for the long-press and never dispatches a second menu.
 * `takeNativeMenu` answers the same for a secondary press the pointer channel
 * took for a drag, which opens its own menu when it is released in place.
 */
export function contextMenuInput(
  core: DispatchCore, takeNativeHold: () => boolean, takeNativeMenu: (e: MouseEvent) => boolean,
): (e: MouseEvent) => void {
  const { routeAt, toWorld, target, dispatch } = core;

  const onContextMenu = (e: MouseEvent) => {
    // Suppress native menu so tools/actions own the right-click UX.
    e.preventDefault();
    if (eventTaken(e)) return;
    if (takeNativeHold() || takeNativeMenu(e)) {
      takeEvent(e);
      return;
    }
    // The keyboard ContextMenu key sends this with no press before it, and
    // the menu's rows resolve through the active scope.
    core.activate(e);
    routeAt(null, e.clientX, e.clientY);
    const w = toWorld(e.clientX, e.clientY);
    // A secondary press reaches the pointer channel only where it could drag,
    // so here there is no press to replay the classification from.
    const ev: InputEvent = {
      kind: 'contextmenu',
      target: e.target,
      x: w.x,
      y: w.y,
      clientX: e.clientX,
      clientY: e.clientY,
      ...underPointer(target(), e, w),
    };
    if (dispatch(ev) === 'handled') takeEvent(e);
  };

  return onContextMenu;
}
