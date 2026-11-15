/**
 * What the three path-effect labs share: the source nodes they seed, the bar
 * of effect actions over the canvas, and the wiring that carries the control
 * panel's settings to the lab's live effects.
 */
import { type ActionParamSchema, type ActionTunings, boundsOfPath, derivedDepOf, type NodeId, pathEffectOf, pathEffectParts, type RectPose, type Scene, useActionsRegistry, useLatest } from '@weasel-js/core';
import { PATH_EFFECTS_GROUP } from '@weasel-js/path-tools';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useTrialConfigChange } from '@weasel-js/labkit';
import { type ReactNode, useEffect, useMemo } from 'react';
import s from './pathEffectLab.module.css';

type LabScene = Scene<unknown, 'default', RectPose>;

/** The path effects a lab's panel sets, each made by the action of the same id. */
type LabEffectKind = 'repeatAlong' | 'bendAlong' | 'tween';

/**
 * The panel's settings for every `kind` effect: written onto each one in `scene` as the panel
 * changes, through the `editPathEffect` action and inside the settings change's undo step, so one
 * Undo takes back the panel and the effects together; and returned as the tuning that hands them
 * to a new `kind` effect made from the bar or its key.
 */
export function usePathEffectSettings<TC, K extends LabEffectKind>(
  scene: LabScene,
  kind: K,
  config: TC,
  settingsOf: (config: TC) => ActionParamSchema[K],
): ActionTunings {
  const registry = useActionsRegistry();
  useTrialConfigChange<TC>((next, prev) => {
    const settings = settingsOf(next);
    if (JSON.stringify(settings) === JSON.stringify(settingsOf(prev))) return;
    const ids = [...scene.renderOrder()].filter((id) => pathEffectOf(scene.get(id))?.kind === kind);
    if (ids.length > 0) registry?.trigger('editPathEffect', { ...settings, ids });
  });
  // Thunked, so a change reaches an action already bound.
  const latest = useLatest(settingsOf(config));
  // A computed key of a generic `K` widens to a string index, so the literal needs the cast to read as K's tuning.
  return useMemo(() => ({ [kind]: { params: () => latest.current } }) as ActionTunings, [kind, latest]);
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
