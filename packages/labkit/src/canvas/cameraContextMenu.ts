import { type Action, ActionDisabledReason, type MenuHost } from '@weasel-js/core';

/** A right-click over a camera, opening the lab's menu on `host`. */
export function cameraContextMenuAction(host: MenuHost): Action {
  return {
    id: 'camera.contextMenu',
    label: 'Show Context Menu',
    defaultBinding: { kind: 'contextMenu' },
    // Disabled when no menu would open, so the press passes to whatever else is bound.
    enabled: (_deps, at) =>
      host.has({ hit: {}, client: { x: 0, y: 0 }, world: at })
        ? true
        : ActionDisabledReason.NotApplicable,
    invoker: {
      timing: 'immediate',
      run: (_deps, params) => {
        const p = params as
          | { clientX?: number; clientY?: number; worldX?: number; worldY?: number }
          | undefined;
        if (p?.clientX === undefined || p.clientY === undefined) return;
        const world =
          p.worldX === undefined || p.worldY === undefined
            ? undefined
            : { x: p.worldX, y: p.worldY };
        host.open({ hit: {}, client: { x: p.clientX, y: p.clientY }, world, source: 'pointer' });
      },
    },
  };
}
