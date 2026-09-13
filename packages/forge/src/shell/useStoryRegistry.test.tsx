import { f } from '@weasel-js/labkit/config';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FromFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { useStoryRegistry } from './useStoryRegistry';

const a: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };
const b: IndexEntry = { id: 'x--b', title: 'X', name: 'B', exportName: 'B', file: '/x.stories.tsx' };
const index = [a, b];
const options = { frameUrl: '/frame.html' };

const readyWith = (label: string): Extract<FromFrame, { type: 'ready' }> => ({
  type: 'ready',
  schema: describeSchema(f.schema({ label: f.string(label) })),
  layout: 'centered',
  viewport: null,
});

function mount() {
  return renderHook(({ entries }) => useStoryRegistry(entries, options), { initialProps: { entries: index } });
}

describe('useStoryRegistry', () => {
  it('keeps the list’s identity across re-renders with the same index', () => {
    const { result, rerender } = mount();
    const first = result.current.instruments;
    rerender({ entries: index });
    expect(result.current.instruments).toBe(first);
    expect(first.map((i) => i.name)).toEqual(['x--a', 'x--b']);
  });

  it('replaces exactly the readied story’s instrument when its description is new', () => {
    const { result } = mount();
    const [beforeA, beforeB] = result.current.instruments;
    act(() => result.current.onReady(a, readyWith('hi')));
    const [afterA, afterB] = result.current.instruments;
    expect(afterA).not.toBe(beforeA);
    expect(afterB).toBe(beforeB);
    expect(afterA?.config?.defaults()).toEqual({ label: 'hi' });
  });

  it('keeps the list’s identity when a ready repeats the description', () => {
    const { result } = mount();
    act(() => result.current.onReady(a, readyWith('hi')));
    const list = result.current.instruments;
    act(() => result.current.onReady(a, readyWith('hi')));
    expect(result.current.instruments).toBe(list);
  });

  it('forgets a story that leaves the index, so its return starts provisional', () => {
    const { result, rerender } = mount();
    act(() => result.current.onReady(a, readyWith('hi')));
    rerender({ entries: [b] });
    expect(result.current.instruments.map((i) => i.name)).toEqual(['x--b']);
    rerender({ entries: index });
    expect(result.current.instruments[0]?.config?.defaults()).toEqual({});
  });
});
