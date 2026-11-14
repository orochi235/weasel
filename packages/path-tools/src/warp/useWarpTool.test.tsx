import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resolveParams } from '@weasel-js/routing';
import { usePlaneWarpTool, useClothWarpTool, usePinWarpTool } from './useWarpTool';

describe('warp tools', () => {
  it('take F, Shift+F and B by default, and a keybinding overrides or omits one', () => {
    const keys = renderHook(() => [usePlaneWarpTool(), useClothWarpTool(), usePinWarpTool()]).result.current
      .map((t) => t.keybinding);
    expect(keys).toEqual([{ key: 'F' }, { key: 'F', shift: true }, { key: 'B' }]);
    expect(renderHook(() => usePinWarpTool({ keybinding: { key: 'Q' } })).result.current.keybinding?.key).toBe('Q');
    expect(renderHook(() => usePinWarpTool({ keybinding: null })).result.current.keybinding).toBeUndefined();
  });

  it('pass only the settings they were given, so tuned params fill in the rest', () => {
    const tool = renderHook(() => useClothWarpTool({ rows: 4 })).result.current;
    const drag = tool.bindings!.find((b) => b.actionId === 'cloth.drag')!;
    expect(resolveParams(drag.opts?.params)).toEqual({ rows: 4 });
  });
});
