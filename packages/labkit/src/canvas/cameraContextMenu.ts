import { type Action, ActionDisabledReason, type MenuHost, type ViewApi } from '@weasel-js/core';
import type { RefObject } from 'react';

type XY = { x: number; y: number };

const INITIAL = [{ channel: '*', phase: 'initial' }] as const;

type CameraCenter = () => { world: XY; client: XY } | null;

/** The middle of a camera's view, in its world and in client coordinates. */
export function cameraCenter(
  hostRef: RefObject<HTMLElement | null>,
  camera: ViewApi,
): ReturnType<CameraCenter> {
  const r = hostRef.current?.getBoundingClientRect();
  if (!r) return null;
  const v = camera.get();
  const client = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  return { client, world: { x: r.width / 2 / v.scale.x + v.x, y: r.height / 2 / v.scale.y + v.y } };
}

export function cameraContextMenuAction(host: MenuHost, center: CameraCenter): Action {
  return {
    id: 'camera.contextMenu',
    label: 'Show Context Menu',
    defaultBinding: [
      { kind: 'contextMenu' },
      { kind: 'key', key: 'F10', mods: { shift: true }, phase: [...INITIAL] },
      { kind: 'key', key: 'ContextMenu', phase: [...INITIAL] },
    ],
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
        if (p?.clientX !== undefined && p.clientY !== undefined) {
          const world =
            p.worldX === undefined || p.worldY === undefined
              ? undefined
              : { x: p.worldX, y: p.worldY };
          host.open({ hit: {}, client: { x: p.clientX, y: p.clientY }, world, source: 'pointer' });
          return;
        }
        const at = center();
        if (at) host.open({ hit: {}, client: at.client, world: at.world, source: 'keyboard' });
      },
    },
  };
}
