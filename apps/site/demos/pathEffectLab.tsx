/**
 * What the three path-effect labs share: the source nodes they seed, the bar
 * of effect actions over the canvas, and the wiring that carries the control
 * panel's settings to the lab's live effects.
 */
import { asNodeId, boundsOfPath, derivedDepOf, type NodeId, pathEffectOf, pathEffectParts, pathFromD, type Fill, type PathEffect, type RectPose, type Scene, type Stroke, useActionsRegistry } from '@weasel-js/core';
import { PATH_EFFECTS_GROUP } from '@weasel-js/path-tools';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useTrialConfigChange } from '@weasel-js/labkit';
import { type ReactNode, useEffect } from 'react';
import s from './pathEffectLab.module.css';

/** A shape node as the kit's own shape tools store one: the path in `data`,
 *  the pose its bounds, turned `rotation` radians about their middle. */
export function pathNode(
  id: string,
  d: string,
  paint: { fill?: Fill | null; stroke?: Stroke | null },
  rotation = 0,
) {
  const path = pathFromD(d);
  const { x, y, width, height } = boundsOfPath(path);
  return {
    kind: 'mark' as const,
    id: asNodeId(id),
    layer: 'default' as const,
    pose: { x, y, width, height, ...(rotation === 0 ? {} : { rotation }) },
    data: { path, ...paint },
  };
}

type LabScene = Scene<unknown, 'default', RectPose>;

/**
 * Writes a change of the panel's settings onto every `kind` effect in `scene`, through the
 * `editPathEffect` action, inside the settings change's undo step: one Undo takes back the panel
 * and the effects together.
 */
export function usePathEffectSettings<TC>(
  scene: LabScene,
  kind: PathEffect['kind'],
  settingsOf: (config: TC) => Record<string, unknown>,
): void {
  const registry = useActionsRegistry();
  useTrialConfigChange<TC>((config, prev) => {
    const next = settingsOf(config);
    if (JSON.stringify(next) === JSON.stringify(settingsOf(prev))) return;
    const ids = [...scene.renderOrder()].filter((id) => pathEffectOf(scene.get(id))?.kind === kind);
    if (ids.length > 0) registry?.trigger('editPathEffect', { ...next, ids });
  });
}

/** The bounds of each part a path effect in `scene` paints, by node id. */
export type PathEffectProbe = Record<string, { x: number; y: number; width: number; height: number }[]>;

/**
 * Test probe `pathEffects`: what each live effect paints right now, read
 * from the live scene, so a test sees what the canvas does rather than what
 * a fresh scene loaded from a snapshot would.
 */
export function usePathEffectProbe(scene: LabScene): void {
  useEffect(() => {
    const hook = window.__weaselTest;
    if (!hook) return;
    return hook.registerProbe('pathEffects', (): PathEffectProbe => {
      const out: PathEffectProbe = {};
      for (const id of scene.renderOrder()) {
        const node = scene.get(id)!;
        if (pathEffectOf(node) === null) continue;
        const deps = (node.dependsOn as readonly NodeId[]).map((d) => derivedDepOf(scene, d));
        out[id] = (pathEffectParts(node, deps) ?? []).map(({ path }) => boundsOfPath(path));
      }
      return out;
    });
  }, [scene]);
}

/** The canvas, with the path-effect actions' bar over it. */
export function PathEffectFrame({ children }: { children: ReactNode }) {
  return (
    <div className={s.frame}>
      {children}
      <ActionBar group={PATH_EFFECTS_GROUP} className={s.bar} />
    </div>
  );
}
