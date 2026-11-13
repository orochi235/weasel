/**
 * Making a path effect is a last operation: its settings form shows after the effect is made, a change remakes it
 * in place, and one undo takes it away.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { rectPath } from '@weasel-js/geom';
import type { ActionsRegistry, DepName, DepRegistry } from '@weasel-js/routing';
import {
  ActionsProvider, createScene, DepRegistryProvider, lastOperationOf, type NodeId, pathEffectOf, type RectPose,
  useActionsRegistry, useDepRegistry, withPathEffectsRegistry,
} from '@weasel-js/core';
import { roughenAction } from './actions';
import { effectSettingDefaults, PATH_EFFECT_PARAMS } from './effectForms';
import { EFFECT_DEFAULTS } from './params';

function setup() {
  const scene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [{
      id: 'a' as NodeId, kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 },
      data: { path: rectPath(0, 0, 100, 100) },
    }],
  });
  let selected: string[] = ['a'];
  const selection = { get: () => selected, set: (next: string[]) => { selected = next; } };
  let registry: ActionsRegistry | null = null;
  let deps: DepRegistry | null = null;
  function Grab() {
    registry = useActionsRegistry();
    deps = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><ActionsProvider><Grab /></ActionsProvider></DepRegistryProvider>);
  const register = (name: string, value: unknown) => deps!.register(name as DepName, () => value as never);
  act(() => {
    register('history', scene.history);
    register('scene', scene);
    register('selection', selection);
    register('selectionSnapshot', {
      take: () => {
        const was = selected;
        return () => { selected = was; };
      },
    });
    registry!.register(roughenAction);
  });
  const effect = () => pathEffectOf(scene.get(selected[0] as NodeId));
  return { scene, registry: registry!, store: lastOperationOf(registry)!, effect };
}

describe('a path effect as the last operation', () => {
  it('shows its settings, remakes the effect with a change, and undoes as one step', () => {
    const { scene, registry, store, effect } = setup();
    act(() => { registry.trigger('roughen'); });
    expect(store.get()).toMatchObject({ id: 'roughen', values: effectSettingDefaults('roughen') });
    expect(effect()).toMatchObject({ kind: 'roughen', size: 5 });
    act(() => { store.adjust({ size: 12, seed: 3 }); });
    expect(effect()).toMatchObject({ kind: 'roughen', size: 12, seed: 3, detail: 4 });
    expect(scene.history.undoDepth()).toBe(1);
    act(() => { scene.history.undo(); });
    expect(scene.roots).toEqual(['a']);
  });

  it('makes a new effect with its form\'s defaults', () => {
    for (const kind of Object.keys(PATH_EFFECT_PARAMS) as (keyof typeof PATH_EFFECT_PARAMS)[]) {
      const defaults = effectSettingDefaults(kind);
      for (const [field, value] of Object.entries(EFFECT_DEFAULTS[kind])) {
        if (field in defaults) expect([kind, field, value]).toEqual([kind, field, defaults[field]]);
      }
    }
  });
});
