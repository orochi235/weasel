import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resolveParams } from '@weasel-js/routing';
import { useDistortTool, useEnvelopeTool, usePuppetTool } from './useWarpTool';

describe('warp tools', () => {
  it('take F, M and B by default, and a keybinding overrides or omits one', () => {
    const keys = renderHook(() => [useDistortTool(), useEnvelopeTool(), usePuppetTool()]).result.current
      .map((t) => t.keybinding?.key);
    expect(keys).toEqual(['F', 'M', 'B']);
    expect(renderHook(() => usePuppetTool({ keybinding: { key: 'Q' } })).result.current.keybinding?.key).toBe('Q');
    expect(renderHook(() => usePuppetTool({ keybinding: null })).result.current.keybinding).toBeUndefined();
  });

  it('pass only the settings they were given, so tuned params fill in the rest', () => {
    const tool = renderHook(() => useEnvelopeTool({ rows: 4 })).result.current;
    const drag = tool.bindings!.find((b) => b.actionId === 'envelope.drag')!;
    expect(resolveParams(drag.opts?.params)).toEqual({ rows: 4 });
  });
});
