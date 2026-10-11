/** The contextmenu channel: a right-click. */
import type { DispatchCore } from '../dispatchCore';
import type { InputEvent } from '../matcher';

export function contextMenuInput(core: DispatchCore): (e: MouseEvent) => void {
  const { routeAt, toWorld, target, dispatch } = core;

  const onContextMenu = (e: MouseEvent) => {
    // Suppress native menu so tools/actions own the right-click UX.
    e.preventDefault();
    routeAt(null, e.clientX, e.clientY);
    const w = toWorld(e.clientX, e.clientY);
    // A secondary button never reaches `onPointerDown`, so unlike click and
    // long-press there is no press to replay the classification from.
    const affordance = target().affordanceAt?.(w) ?? undefined;
    const menuBody = target().classifyTarget?.(w);
    const ev: InputEvent = {
      kind: 'contextmenu',
      target: e.target,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      x: w.x,
      y: w.y,
      clientX: e.clientX,
      clientY: e.clientY,
      ...(affordance !== undefined ? { affordance } : {}),
      ...(menuBody?.body !== undefined ? { bodyTarget: menuBody.body } : {}),
      ...(menuBody?.kind !== undefined ? { bodyKind: menuBody.kind } : {}),
    };
    dispatch(ev);
  };

  return onContextMenu;
}
