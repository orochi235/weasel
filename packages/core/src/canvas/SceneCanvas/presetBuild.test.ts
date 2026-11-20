import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resolveFeatures } from './features';
import { usePresetBuilds, type PresetBuildSource } from './presetBuild';
import { resolveToolRegistry, type BuiltinTools } from './toolRegistry';
import type { Tool } from 'tools/overlayBinding';

const snap = { id: 'snap' };
const other = { id: 'other' };

function setup() {
  const build = vi.fn(() => ({}));
  const enabled = resolveFeatures([{ id: 'p', build }]);
  const source = (toolOptions: PresetBuildSource['toolOptions']) => ({ toolOptions } as unknown as PresetBuildSource);
  return { build, enabled, source };
}

describe('usePresetBuilds', () => {
  it('does not rebuild for an inline toolOptions whose array field holds the same values', () => {
    const { build, enabled, source } = setup();
    const { rerender } = renderHook(({ s }) => usePresetBuilds(enabled, s), {
      initialProps: { s: source({ insert: { behaviors: [snap] } } as PresetBuildSource['toolOptions']) },
    });
    rerender({ s: source({ insert: { behaviors: [snap] } } as PresetBuildSource['toolOptions']) });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when an array field holds another value', () => {
    const { build, enabled, source } = setup();
    const { rerender } = renderHook(({ s }) => usePresetBuilds(enabled, s), {
      initialProps: { s: source({ insert: { behaviors: [snap] } } as PresetBuildSource['toolOptions']) },
    });
    rerender({ s: source({ insert: { behaviors: [other] } } as PresetBuildSource['toolOptions']) });
    expect(build).toHaveBeenCalledTimes(2);
  });
});

describe('usePresetBuilds with preset tools of their own', () => {
  const tool = (id: string): Tool => ({ id, eligibility: { focus: true } }) as Tool;
  const mounted = (enabled: ReturnType<typeof resolveFeatures>) => {
    const { result } = renderHook(() => usePresetBuilds(enabled, { toolOptions: undefined } as unknown as PresetBuildSource));
    return resolveToolRegistry({ builtins: {} as BuiltinTools, offered: result.current.tools, enabled, patch: null });
  };

  it("mounts a refining preset's built tool over the tool of its own the refined preset lists", () => {
    const own = tool('x');
    const built = tool('x');
    const enabled = resolveFeatures([
      { id: 'a', tools: [own] },
      { id: 'r', refines: ['a'], tools: ['x'], build: () => ({ tools: { x: built } }) },
    ]);
    expect(mounted(enabled).x).toBe(built);
  });

  it("keeps a refining preset's own tool over the one a refined preset builds", () => {
    const own = tool('x');
    const enabled = resolveFeatures([
      { id: 'r', refines: ['a'], tools: [own] },
      { id: 'a', tools: ['x'], build: () => ({ tools: { x: tool('x') } }) },
    ]);
    expect(mounted(enabled).x).toBe(own);
  });

  it('throws when unrelated presets build and list different tools of one id', () => {
    const enabled = resolveFeatures([
      { id: 'a', tools: [tool('x')] },
      { id: 'b', tools: ['x'], build: () => ({ tools: { x: tool('x') } }) },
    ]);
    expect(() => mounted(enabled)).toThrow(/"b" and "a"|"a" and "b"/);
  });
});
