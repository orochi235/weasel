/**
 * What the three warp labs share: a palette command that expands the
 * selection's warp, the control panel's settings reaching a warp already
 * held, and the shapes they open on.
 */
import { asNodeId, boundsOfPath, type PolygonPath, type RectPose, solid, useActionsRegistry } from '@weasel-js/core';
import { type WarpKind, type WarpSettings } from '@weasel-js/path-tools';
import { type TrialContribution, useTrialConfigChange } from '@weasel-js/labkit';
import { icon } from '../icons.gen';

/**
 * Remakes the selection's held warp when the panel changes, through `configureWarp`, inside the
 * settings change's undo step: the tool's settings only shape a warp it makes, and one Undo takes
 * back the panel and the warp together. Each warp lab's config is exactly its warp's settings.
 */
export function useHeldWarpSettings(kind: WarpKind): void {
  const registry = useActionsRegistry();
  useTrialConfigChange<WarpSettings>((config) => {
    registry?.trigger('configureWarp', { kind, ...config });
  });
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
