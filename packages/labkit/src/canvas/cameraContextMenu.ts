import { type Action, ActionDisabledReason, type MenuHost } from '@weasel-js/core';
import type { RefObject } from 'react';
import type { CameraView } from './CameraInput';
import { viewMiddle } from './cameraZoom';

type XY = { x: number; y: number };

const INITIAL = [{ channel: '*', phase: 'initial' }] as const;

type Anchor = { world: XY; client: XY };

/** The middle of a camera's view, in client coordinates and in its world. */
export function cameraCenter(
  hostRef: RefObject<HTMLElement | null>,
  camera: CameraView,
  clientToWorld: (cx: number, cy: number) => XY,
): Anchor | null {
  const r = hostRef.current?.getBoundingClientRect();
  if (!r) return null;
  const middle = viewMiddle(camera);
  const client = { x: r.left + middle.x, y: r.top + middle.y };
  return { client, world: clientToWorld(client.x, client.y) };
}

export function cameraContextMenuAction(host: MenuHost, center: () => Anchor | null): Action {
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
