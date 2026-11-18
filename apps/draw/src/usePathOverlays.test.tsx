import { act, renderHook } from '@testing-library/react';
import { always, never, type ActionDeps, type ChromeRulesDep, type ImmediateInvoker } from '@weasel-js/core';
import {
  PATH_POISE_CHROME_ID, PATH_COMB_CHROME_ID, PATH_FILLETS_CHROME_ID, PATH_DIRECTION_CHROME_ID,
  showPoiseAction, showCombAction, showFilletsAction, showDirectionAction,
} from '@weasel-js/path-tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawPrefs } from './prefs';
import { usePathOverlays } from './usePathOverlays';

beforeEach(() => act(() => drawPrefs().reset()));

const TOGGLES = [
  [showDirectionAction, PATH_DIRECTION_CHROME_ID, 'view.pathEditing.direction', false],
  [showCombAction, PATH_COMB_CHROME_ID, 'view.pathEditing.comb', false],
  [showPoiseAction, PATH_POISE_CHROME_ID, 'view.pathEditing.poise', false],
  [showFilletsAction, PATH_FILLETS_CHROME_ID, 'view.pathEditing.fillets', true],
] as const;

function setup() {
  const { result } = renderHook(() => usePathOverlays());
  const below: ChromeRulesDep = { get: vi.fn(() => always), set: vi.fn() };
  const deps = () => {
    const source = result.current.contribution.deps!.chromeRules!;
    return { chromeRules: source(() => below) } as unknown as ActionDeps;
  };
  return { result, below, deps };
}

describe('usePathOverlays', () => {
  it.each(TOGGLES)('flips %s between always and never through its View preference', (action, chromeId, path, shown) => {
    const { result, deps } = setup();
    const run = () => act(() => (action.invoker as ImmediateInvoker).run(deps()));
    expect(result.current.chromeVisibility[chromeId]).toBe(shown ? always : never);
    expect(action.active!(deps())).toBe(shown);
    run();
    expect(drawPrefs().get(path)).toBe(!shown);
    expect(result.current.chromeVisibility[chromeId]).toBe(shown ? never : always);
    expect(action.active!(deps())).toBe(!shown);
    run();
    expect(drawPrefs().get(path)).toBe(shown);
  });

  it('leaves every other chrome id to the canvas', () => {
    const { below, deps } = setup();
    const rules = deps().chromeRules!;
    expect(rules.get('snap.guides')).toBe(always);
    rules.set('snap.guides', never);
    expect(below.set).toHaveBeenCalledWith('snap.guides', never);
  });
});
