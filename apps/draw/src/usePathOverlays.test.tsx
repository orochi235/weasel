import { act, renderHook } from '@testing-library/react';
import { always, never, type ActionDeps, type ChromeRulesDep, type ImmediateInvoker } from '@weasel-js/core';
import {
  PATH_BALANCE_CHROME_ID, PATH_COMB_CHROME_ID, PATH_CORNERS_CHROME_ID, PATH_DIRECTION_CHROME_ID,
  showBalanceAction, showCombAction, showCornersAction, showDirectionAction,
} from '@weasel-js/path-tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawPrefs } from './prefs';
import { usePathOverlays } from './usePathOverlays';

beforeEach(() => act(() => drawPrefs().reset()));

const TOGGLES = [
  [showDirectionAction, PATH_DIRECTION_CHROME_ID, 'view.pathDirection', false],
  [showCombAction, PATH_COMB_CHROME_ID, 'view.pathComb', false],
  [showBalanceAction, PATH_BALANCE_CHROME_ID, 'view.pathBalance', false],
  [showCornersAction, PATH_CORNERS_CHROME_ID, 'view.pathCorners', true],
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
