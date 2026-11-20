import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { librariesFrom } from '../story/library';
import type { IndexEntry, LoadedStory } from '../story/types';
import { type StoryLoadSource, useStoryLoads } from './storyLoads';

const entry = (name: string): IndexEntry => ({ id: `x--${name.toLowerCase()}`, title: 'X', name, exportName: name, file: '/x.stories.tsx' });
const index = [entry('A'), entry('B'), entry('C')];

function source(prepare: (story: LoadedStory) => Promise<void>): StoryLoadSource {
  const mod = { A: {}, B: {}, C: {} };
  return {
    index,
    importers: { '/x.stories.tsx': () => Promise.resolve(mod) },
    setup: { prepare },
    load: () => index.map((e) => ({ id: e.id, exportName: e.exportName }) as LoadedStory),
    libraries: librariesFrom(undefined),
  };
}

describe('useStoryLoads', () => {
  it('loads and prepares a file once for every entry asked for while it loads, and keeps what landed', async () => {
    const prepare = vi.fn(() => Promise.resolve());
    const live = source(prepare);
    const { result } = renderHook(() => useStoryLoads(live));
    await act(async () => {
      for (const e of index) result.current.request(e);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(prepare).toHaveBeenCalledTimes(3);
    const first = result.current.loaded.get('x--a');
    expect(first).toBeDefined();
    await act(async () => {
      result.current.request(index[1]!);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(prepare).toHaveBeenCalledTimes(3);
    expect(result.current.loaded.get('x--a')).toBe(first);
  });

  it('loads a file again after a reload', async () => {
    const prepare = vi.fn(() => Promise.resolve());
    const live = source(prepare);
    const { result } = renderHook(() => useStoryLoads(live));
    await act(async () => {
      result.current.request(index[0]!);
      await new Promise((r) => setTimeout(r, 0));
    });
    act(() => result.current.reload('/x.stories.tsx'));
    expect(result.current.loaded.has('x--a')).toBe(false);
    await act(async () => {
      result.current.request(index[0]!);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(prepare).toHaveBeenCalledTimes(6);
    expect(result.current.loaded.has('x--b')).toBe(true);
  });
});
