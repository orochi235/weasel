import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { always, never, type ChromeRulesDep, type VisibilityRules } from '@weasel-js/core';
import { curvatureCombPreset, cornerShapePreset } from '../presets';
import { showCombAction, showCornersAction } from './showOverlay';

function rules(initial: VisibilityRules): ChromeRulesDep & { all: VisibilityRules } {
  const all: VisibilityRules = { ...initial };
  return { all, get: (id) => all[id], set: (id, rule) => { all[id] = rule; } };
}

const run = (a: { invoker?: unknown }, deps: unknown) => (a.invoker as ImmediateInvoker).run(deps as never, undefined);

describe('the overlay toggles', () => {
  it('flip a hidden overlay to always and back to never', () => {
    const dep = rules({ ...curvatureCombPreset.chromeRules });
    const deps = { chromeRules: dep };
    expect(showCombAction.active?.(deps as never)).toBe(false);
    run(showCombAction, deps);
    expect(dep.all['path-edit.comb']).toBe(always);
    expect(showCombAction.active?.(deps as never)).toBe(true);
    run(showCombAction, deps);
    expect(dep.all['path-edit.comb']).toBe(never);
  });

  it('read an overlay with no rule as shown, and hide it', () => {
    const dep = rules({});
    expect(showCornersAction.active?.({ chromeRules: dep } as never)).toBe(true);
    run(showCornersAction, { chromeRules: dep });
    expect(dep.all['path-edit.corners']).toBe(never);
  });

  it('come with the overlay they toggle, in the pathOverlays group', () => {
    expect(curvatureCombPreset.actions).toContain(showCombAction);
    expect(cornerShapePreset.actions).toContain(showCornersAction);
    expect(showCombAction.id).toBe('pathEdit.show.comb');
    expect(showCombAction.group).toBe('pathOverlays');
  });

  it('are disabled with no chromeRules dep', () => {
    expect(showCombAction.enabled?.({} as never)).not.toBe(true);
  });
});
