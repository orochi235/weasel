/** The contextmenu channel: a right-click. */
import type { DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';
import { underPointer } from '../underPointer';

/**
 * `takeNativeHold` answers whether a touch or pen hold is in progress, firing
 * its long-press if that is still pending. A browser that sends `contextmenu`
 * for a hold (Android Chrome) is reporting the same hold the dispatcher times,
 * so the event stands for the long-press and never dispatches a second menu.
 */
export function contextMenuInput(core: DispatchCore, takeNativeHold: () => boolean): (e: MouseEvent) => void {
  const { routeAt, toWorld, target, dispatch } = core;

  const onContextMenu = (e: MouseEvent) => {
    // Suppress native menu so tools/actions own the right-click UX.
    e.preventDefault();
    if (takeNativeHold()) return;
    // The keyboard ContextMenu key sends this with no press before it, and
    // the menu's rows resolve through the active scope.
    core.activate();
    routeAt(null, e.clientX, e.clientY);
    const w = toWorld(e.clientX, e.clientY);
    // A secondary button never reaches `onPointerDown`, so unlike click and
    // long-press there is no press to replay the classification from.
    const ev: InputEvent = {
      kind: 'contextmenu',
      target: e.target,
      x: w.x,
      y: w.y,
      clientX: e.clientX,
      clientY: e.clientY,
      ...underPointer(target(), e, w),
    };
    dispatch(ev);
  };

  return onContextMenu;
}
