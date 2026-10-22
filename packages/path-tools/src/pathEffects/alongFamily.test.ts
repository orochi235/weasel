import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx } from '@weasel-js/routing';
import {
  createScene, deleteAction, type NodeId, pathEffectOf, type RectPose, type Scene, withPathEffectsRegistry,
} from '@weasel-js/core';
import { bendAlongAction, editPathEffectAction, expandPathEffectAction, textAlongAction } from './actions';
import { releasePathEffectAction, setEffectPathAction } from './retarget';
import { pathEffectSettingsParams, readPathEffectSettings } from './settingsForm';

type TestScene = Scene<unknown, 'default', RectPose>;

const line = (id: string, y: number) => ({
  id: id as NodeId,
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x: 0, y, width: 200, height: 0 },
  data: { path: { kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 200, 0]), fillRule: 'nonzero' }, stroke: { paint: { color: '#000' }, width: 1 } },
});

const text = (id: string) => ({
  id: id as NodeId,
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x: 0, y: 0, width: 100, height: 20 },
  data: { text: 'Hi', style: { fontSize: 16 } },
});

const box = (id: string) => ({
  id: id as NodeId,
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x: 0, y: 0, width: 20, height: 20 },
  data: { path: rectPath(0, 0, 20, 20), fill: { paint: { color: '#f00' } } },
});

/** Back to front: `p`, `t`, `q`, `t2`, `r`, `s`. */
function setup(selected: string[]) {
  const scene: TestScene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [line('p', 100), text('t'), line('q', 200), text('t2'), box('r'), box('s')],
  });
  let current = selected;
  const selection = { get: () => current, set: (next: string[]) => { current = next; } };
  const deps = { scene, selection } as unknown as InvocationCtx['deps'];
  return { scene, deps, select: (ids: string[]) => { current = ids; }, selected: () => current };
}

const run = (action: { invoker?: unknown }, deps: InvocationCtx['deps'], params?: Record<string, unknown>) =>
  (action.invoker as ImmediateInvoker).run(deps, params);

const hidden = (scene: TestScene, id: string) => scene.isHidden(id as NodeId);

/** A text-along node of `t` on `p`, made from a selection of path then text. */
function textAlong() {
  const env = setup(['p', 't']);
  run(textAlongAction, env.deps);
  return { ...env, fx: env.selected()[0]! };
}

describe('Text Along Path', () => {
  it('orders text first and hides both', () => {
    const { scene, fx } = textAlong();
    const node = scene.get(fx as NodeId)!;
    expect(pathEffectOf(node)).toMatchObject({ kind: 'textAlong', hideSources: true });
    expect(node.dependsOn).toEqual(['t', 'p']);
    // Above the upper source.
    expect(scene.roots.indexOf(fx as NodeId)).toBe(2);
    expect(hidden(scene, 't')).toBe(true);
    expect(hidden(scene, 'p')).toBe(true);
    scene.undo();
    expect(scene.get(fx as NodeId)).toBeUndefined();
    expect(hidden(scene, 't')).toBe(false);
    expect(hidden(scene, 'p')).toBe(false);
  });

  it('needs one text and one non-text leaf', () => {
    expect(textAlongAction.enabled!(setup(['r', 's']).deps)).not.toBe(true);
    expect(textAlongAction.enabled!(setup(['t', 't2']).deps)).not.toBe(true);
    expect(textAlongAction.enabled!(setup(['t', 'p', 'q']).deps)).not.toBe(true);
    expect(textAlongAction.enabled!(setup(['t', 'p']).deps)).toBe(true);
  });

  it('binds Alt+Shift+X, which no browser takes', () => {
    expect(textAlongAction.defaultBinding).toMatchObject([{ spec: { key: 'x', code: 'KeyX', mods: { alt: true, shift: true } } }]);
  });
});

describe('Release', () => {
  it('deletes the effect and shows its sources', () => {
    const { scene, deps, selected, fx } = textAlong();
    expect(releasePathEffectAction.enabled!(deps)).toBe(true);
    run(releasePathEffectAction, deps);
    expect(scene.get(fx as NodeId)).toBeUndefined();
    expect(hidden(scene, 't')).toBe(false);
    expect(hidden(scene, 'p')).toBe(false);
    expect(selected()).toEqual(['t', 'p']);
    scene.undo();
    expect(scene.get(fx as NodeId)).toBeDefined();
    expect(hidden(scene, 't')).toBe(true);
    expect(hidden(scene, 'p')).toBe(true);
  });

  it('keeps a source hidden that another effect still hides', () => {
    const { scene, deps, select, fx } = textAlong();
    select(['t2', 'p']);
    run(textAlongAction, deps);
    select([fx]);
    run(releasePathEffectAction, deps);
    expect(hidden(scene, 't')).toBe(false);
    expect(hidden(scene, 'p')).toBe(true);
  });
});

describe('Set Path', () => {
  it('moves the hidden flag to the new path', () => {
    const { scene, deps, select, selected, fx } = textAlong();
    select(['q', fx]);
    expect(setEffectPathAction.enabled!(deps)).toBe(true);
    run(setEffectPathAction, deps);
    expect(scene.get(fx as NodeId)!.dependsOn).toEqual(['t', 'q']);
    expect(hidden(scene, 'p')).toBe(false);
    expect(hidden(scene, 'q')).toBe(true);
    expect(selected()).toEqual([fx]);
    scene.undo();
    expect(scene.get(fx as NodeId)!.dependsOn).toEqual(['t', 'p']);
    expect(hidden(scene, 'p')).toBe(true);
    expect(hidden(scene, 'q')).toBe(false);
  });

  it('retargets a bend without touching what it shows', () => {
    const { scene, deps, select, selected } = setup(['r', 'p']);
    run(bendAlongAction, deps);
    const fx = selected()[0]!;
    select([fx, 'q']);
    run(setEffectPathAction, deps);
    expect(scene.get(fx as NodeId)!.dependsOn).toEqual(['r', 'q']);
    expect(hidden(scene, 'p')).toBe(false);
    expect(hidden(scene, 'q')).toBe(false);
  });

  it('is disabled where the path derives from the effect, or is already its source', () => {
    const { deps, select, selected, fx } = textAlong();
    select([fx, 'r']);
    run(bendAlongAction, deps);
    const bend = selected()[0]!;
    select([fx, bend]);
    expect(setEffectPathAction.enabled!(deps)).not.toBe(true);
    select([fx, 't']);
    expect(setEffectPathAction.enabled!(deps)).not.toBe(true);
  });
});

describe('removing an effect that hides its sources', () => {
  it('Expand to Paths takes hidden sources with it', () => {
    const { scene, deps, fx } = textAlong();
    run(expandPathEffectAction, deps);
    expect(scene.get(fx as NodeId)).toBeUndefined();
    expect(scene.get('t' as NodeId)).toBeUndefined();
    expect(scene.get('p' as NodeId)).toBeUndefined();
    scene.undo();
    expect(scene.get(fx as NodeId)).toBeDefined();
    expect(scene.roots).toEqual(['p', 't', fx, 'q', 't2', 'r', 's']);
    expect(hidden(scene, 't')).toBe(true);
  });

  it('Delete takes hidden sources with it, as one undo step', () => {
    const { scene, deps, fx } = textAlong();
    run(deleteAction, deps);
    expect(scene.get(fx as NodeId)).toBeUndefined();
    expect(scene.get('t' as NodeId)).toBeUndefined();
    expect(scene.get('p' as NodeId)).toBeUndefined();
    scene.undo();
    expect(scene.roots).toEqual(['p', 't', fx, 'q', 't2', 'r', 's']);
  });

  it('an effect without hideSources leaves its sources', () => {
    const { scene, deps, selected } = setup(['r', 'p']);
    run(bendAlongAction, deps);
    expect(selected()).toHaveLength(1);
    run(deleteAction, deps);
    expect(scene.get('r' as NodeId)).toBeDefined();
    expect(scene.get('p' as NodeId)).toBeDefined();
  });
});

describe('the settings form', () => {
  it('reads and writes the text-along fields', () => {
    const { scene, deps, fx } = textAlong();
    const { values } = readPathEffectSettings(deps);
    expect(values).toMatchObject({ texts: 1, textAlong: { side: 'auto', start: 0, anchor: 'baseline' } });
    expect(pathEffectSettingsParams('textAlong.side', 'flipped')).toEqual({ kind: 'textAlong', side: 'flipped' });
    run(editPathEffectAction, deps, { kind: 'textAlong', side: 'flipped' });
    expect(pathEffectOf(scene.get(fx as NodeId))).toMatchObject({ side: 'flipped' });
  });
});
