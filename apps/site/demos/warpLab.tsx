/**
 * What the three warp labs share: a palette command that expands the
 * selection's warp, the control panel's settings reaching a warp already
 * held, and the shapes they open on.
 */
import { type ActionsRegistry, asNodeId, boundsOfPath, type PolygonPath, type RectPose, solid, useActionsRegistry } from '@weasel-js/core';
import { type WarpKind, type WarpSettings } from '@weasel-js/path-tools';
import type { TrialContribution } from '@weasel-js/labkit';
import { useEffect } from 'react';
import { icon } from '../icons.gen';

/** Each trial's action registry, so its palette command fires on its own canvas. */
const registries = new Map<string, Pick<ActionsRegistry, 'trigger'>>();

/**
 * Register the trial's actions for {@link expandWarpCommand}, and remake the
 * selection's held warp whenever `settings` change: the tool's settings only
 * shape a warp it makes, so a change to them reaches one already made through
 * `configureWarp`.
 */
export function useWarpLabActions(trialId: string, kind: WarpKind, settings: WarpSettings): void {
  const registry = useActionsRegistry();
  useEffect(() => {
    if (!registry) return;
    registries.set(trialId, registry);
    return () => {
      if (registries.get(trialId) === registry) registries.delete(trialId);
    };
  }, [registry, trialId]);
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
    onActivate: (ctx) => { registries.get(ctx.trialId)?.trigger('expandWarp'); },
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
