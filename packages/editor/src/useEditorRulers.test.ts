import { act, renderHook } from '@testing-library/react';
import type { UnitScope } from '@weasel-js/core';
import type { RulersSettings } from '@weasel-js/guides';
import { describe, expect, it } from 'vitest';
import { useEditorRulers } from './useEditorRulers';

const ROOT: UnitScope = { system: { base: 'px', units: { px: 1 } } };

/** The hook over settings held in state, as an app's prefs would hold them. */
function renderHeld(initial: RulersSettings) {
  let settings = initial;
  const writes: RulersSettings[] = [];
  const hook = renderHook(() => useEditorRulers({
    settings,
    setSettings: (next) => {
      settings = next;
      writes.push(next);
    },
    root: ROOT,
  }));
  return { hook, writes };
}

describe('useEditorRulers', () => {
  it('hands out the rulers only while shown, and keeps the guides layer and snap source either way', () => {
    const { hook } = renderHeld({ visible: false });
    const hidden = hook.result.current;
    expect(hidden.visible).toBe(false);
    expect(hidden.rulers).toBeNull();
    expect(hidden.layer).toBeDefined();
    expect(hidden.snapSource).toBeDefined();
  });

  it('toggles the setting, and the rulers it hands out keep their identity across renders', () => {
    const { hook, writes } = renderHeld({ visible: false });
    act(() => hook.result.current.toggle());
    expect(writes).toEqual([{ visible: true }]);
    hook.rerender();
    const shown = hook.result.current;
    expect(shown.visible).toBe(true);
    expect(shown.rulers).not.toBeNull();
    hook.rerender();
    expect(hook.result.current.rulers).toBe(shown.rulers);
    expect(hook.result.current.layer).toBe(shown.layer);
    expect(hook.result.current.snapSource).toBe(shown.snapSource);
  });
});
