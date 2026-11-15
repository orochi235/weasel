/**
 * What the three warp labs share: a palette command that expands the
 * selection's warp, the control panel's settings reaching a warp already
 * held, and the shapes they open on.
 */
import { asNodeId, boundsOfPath, type PolygonPath, type RectPose, solid, useActionsRegistry } from '@weasel-js/core';
import { type WarpKind, type WarpSettings } from '@weasel-js/path-tools';
import type { TrialContribution } from '@weasel-js/labkit';
import { useEffect } from 'react';
import { icon } from '../icons.gen';

/**
 * Remake the selection's held warp whenever `settings` change: the tool's
 * settings only shape a warp it makes, so a change to them reaches one already
 * made through `configureWarp`.
 */
export function useHeldWarpSettings(kind: WarpKind, settings: WarpSettings): void {
  const registry = useActionsRegistry();
  const key = JSON.stringify(settings);
  useEffect(() => {
    registry?.trigger('configureWarp', { kind, ...(JSON.parse(key) as WarpSettings) });
  }, [registry, kind, key]);
}

/** A palette command dropping the selection's warp and keeping its geometry. */
export const expandWarpCommand: TrialContribution = {
  id: 'expand-warp',
  region: 'palette',
  item: {
    icon: icon('ui:check'),
    label: 'Expand warp',
    onActivate: (ctx) => { ctx.runAction('expandWarp'); },
  },
};

/** A leaf storing `path` on `data.path`, posed at the path's own box. */
export function pathLeaf(id: string, path: PolygonPath, color: string, extra: Record<string, unknown> = {}) {
  const b = boundsOfPath(path);
  return {
    id: asNodeId(id),
    kind: 'mark' as const,
    layer: 'default' as const,
    pose: { x: b.x, y: b.y, width: b.width, height: b.height } as RectPose,
    data: { path, fill: { paint: solid(color) }, ...extra },
  };
}
