import { act, renderHook } from '@testing-library/react';
import { always, never, PATH_DIRECTION_CHROME_ID, type ActionDeps, type ImmediateInvoker } from '@weasel-js/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { togglePathDirectionAction } from './appCommands/actions';
import { drawPrefs } from './prefs';
import { usePathDirection } from './usePathDirection';

beforeEach(() => act(() => drawPrefs().reset()));

const rule = (r: { current: ReturnType<typeof usePathDirection> }) =>
  r.current.chromeVisibility[PATH_DIRECTION_CHROME_ID];

describe('usePathDirection', () => {
  it('hides path-edit.direction on a first run, and the View toggle shows and hides it', () => {
    const { result } = renderHook(() => usePathDirection());
    expect(rule(result)).toBe(never);

    const deps = () => ({ appCommands: { ...result.current.commands } }) as unknown as ActionDeps;
    const toggle = () => act(() => (togglePathDirectionAction.invoker as ImmediateInvoker).run(deps()));
    expect(togglePathDirectionAction.active!(deps())).toBe(false);
    toggle();
    expect(rule(result)).toBe(always);
    expect(drawPrefs().get('view.pathDirection')).toBe(true);
    expect(togglePathDirectionAction.active!(deps())).toBe(true);
    toggle();
    expect(rule(result)).toBe(never);
  });
});
