import { Lab } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type FromFrame, stableStringify } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { connectFrame, flush, installResizeObserver } from './labHarness';
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

  it('appends the declared globals to every story’s schema, provisional or described', () => {
    const globals = { mode: { label: 'Mode', default: 'auto', options: [{ value: 'dark', label: 'Dark' }] } };
    const { result } = renderHook(() => useStoryRegistry(index, { ...options, globals }));
    expect(result.current.instruments[0]?.config?.defaults()).toEqual({ $globals: { mode: 'lab' } });
    act(() => result.current.onReady(a, readyWith('hi')));
    expect(result.current.instruments[0]?.config?.defaults()).toEqual({ label: 'hi', $globals: { mode: 'lab' } });
    expect(result.current.instruments[1]?.config?.defaults()).toEqual({ $globals: { mode: 'lab' } });
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

describe('useStoryRegistry under a lab', () => {
  installResizeObserver();

  const conditional: Extract<FromFrame, { type: 'ready' }> = {
    type: 'ready',
    schema: describeSchema(f.schema({ show: f.boolean(true), size: f.number(4).showIf((c) => c.show === true) })),
    layout: 'centered',
    viewport: null,
  };

  function RegistryLab() {
    const registry = useStoryRegistry([a], options);
    return <Lab instruments={registry.instruments} defaultInstrument={a.id} />;
  }

  it('follows the frame’s answers in the settings panel without other input', async () => {
    const view = render(<RegistryLab />);
    const { frame } = connectFrame(view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
    frame.send(conditional);
    await flush();
    expect(screen.getByLabelText('Size')).toBeTruthy();
    frame.send({
      type: 'answers',
      answers: { configKey: stableStringify({ show: true, size: 4 }), hidden: ['size'], errors: {} },
    });
    await flush();
    expect(screen.queryByLabelText('Size')).toBeNull();
    frame.close();
  });

  it('keeps the instrument when an answer arrives for a config no trial holds', async () => {
    const instruments: unknown[] = [];
    function Spy() {
      const registry = useStoryRegistry([a], options);
      instruments.push(registry.instruments[0]);
      return <Lab instruments={registry.instruments} defaultInstrument={a.id} />;
    }
    const view = render(<Spy />);
    const { frame, received } = connectFrame(view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
    frame.send(conditional);
    await flush();
    const settled = instruments.at(-1);
    const sent = received.length;
    frame.send({
      type: 'answers',
      answers: { configKey: stableStringify({ show: false, size: 4 }), hidden: ['size'], errors: {} },
    });
    await flush();
    expect(instruments.at(-1)).toBe(settled);
    expect(received.length).toBe(sent);
    expect(screen.getByLabelText('Size')).toBeTruthy();
    frame.close();
  });
});
