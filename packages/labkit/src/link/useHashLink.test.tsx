import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type LinkRead, type LinkSpec, packLink } from './link';
import { type HashLinkOptions, hashLink, useHashLink } from './useHashLink';

interface Shape {
  hue: number;
}

const spec: LinkSpec<Shape> = {
  version: 2,
  clean: (value) =>
    typeof (value as Shape).hue === 'number' ? { hue: (value as Shape).hue } : null,
};
const DEFAULT: Shape = { hue: 0 };

let set: (value: Shape) => void = () => {};
let applied: Shape[] = [];

function Probe({ options }: { options?: HashLinkOptions<Shape> }) {
  const [state, setState] = useState<Shape>(() => {
    const read = hashLink(spec);
    return read?.ok ? read.value : DEFAULT;
  });
  set = setState;
  useHashLink(
    state,
    (next) => {
      applied.push(next);
      setState(next);
    },
    spec,
    options,
  );
  return <output>{state.hue}</output>;
}

const hash = () => location.hash.replace(/^#/, '');

async function pasteHash(text: string) {
  await act(async () => {
    history.replaceState(null, '', `#${text}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  applied = [];
  history.replaceState(null, '', '/lab?x=1');
});

afterEach(() => {
  vi.useRealTimers();
  history.replaceState(null, '', '/');
});

describe('useHashLink', () => {
  it('starts from the hash, and hands nothing over at mount when the state already matches', () => {
    history.replaceState(null, '', `#${packLink({ hue: 40 }, spec)}`);
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('40');
    expect(applied).toEqual([]);
  });

  it('writes an empty hash with the state at mount', () => {
    render(<Probe />);
    act(() => vi.advanceTimersByTime(250));
    expect(hash()).toBe(packLink(DEFAULT, spec));
    expect(location.pathname + location.search).toBe('/lab?x=1');
  });

  it('writes once per burst, after the delay, with replaceState', () => {
    const replace = vi.spyOn(history, 'replaceState');
    const push = vi.spyOn(history, 'pushState');
    render(<Probe />);
    act(() => vi.advanceTimersByTime(250));
    replace.mockClear();
    for (const hue of [1, 2, 3]) {
      act(() => set({ hue }));
      act(() => vi.advanceTimersByTime(100));
    }
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(250));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(hash()).toBe(packLink({ hue: 3 }, spec));
  });

  it('a write never hands the value back through apply', () => {
    render(<Probe />);
    act(() => set({ hue: 9 }));
    act(() => vi.advanceTimersByTime(250));
    expect(applied).toEqual([]);
  });

  it('hands a pasted link to apply, canceling a write still waiting', async () => {
    const { container } = render(<Probe />);
    act(() => vi.advanceTimersByTime(250));
    act(() => set({ hue: 5 }));
    const pasted = packLink({ hue: 77 }, spec);
    await pasteHash(pasted);
    expect(applied).toEqual([{ hue: 77 }]);
    expect(container.textContent).toBe('77');
    act(() => vi.advanceTimersByTime(1000));
    expect(hash()).toBe(pasted);
  });

  it('reports a hash it cannot read and falls back, keeping the link until the state changes', async () => {
    const reports: LinkRead<Shape>[] = [];
    const newer = packLink({ hue: 1 }, { version: 3 });
    history.replaceState(null, '', `#${newer}`);
    const { container } = render(<Probe options={{ onReport: (r) => reports.push(r) }} />);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ ok: false, fault: 'newer', version: 3 });
    expect(container.textContent).toBe('0');
    act(() => vi.advanceTimersByTime(1000));
    expect(hash()).toBe(newer);
    act(() => set({ hue: 4 }));
    act(() => vi.advanceTimersByTime(250));
    expect(hash()).toBe(packLink({ hue: 4 }, spec));
  });

  it('puts the state to `fallback` on a junk hash, and never throws', async () => {
    const reports: LinkRead<Shape>[] = [];
    const { container } = render(
      <Probe options={{ fallback: DEFAULT, onReport: (r) => reports.push(r) }} />,
    );
    act(() => set({ hue: 12 }));
    act(() => vi.advanceTimersByTime(250));
    await pasteHash('2.not*base64');
    expect(reports.at(-1)).toMatchObject({ ok: false, fault: 'malformed' });
    expect(container.textContent).toBe('0');
    expect(hash()).toBe('2.not*base64');
  });

  it('keeps the state on a junk hash with no fallback', async () => {
    const { container } = render(<Probe />);
    act(() => set({ hue: 12 }));
    act(() => vi.advanceTimersByTime(250));
    await pasteHash('2.e30');
    expect(container.textContent).toBe('12');
    expect(applied).toEqual([]);
  });

  it('flushes a waiting write when it unmounts', () => {
    const { unmount } = render(<Probe />);
    act(() => vi.advanceTimersByTime(250));
    act(() => set({ hue: 6 }));
    unmount();
    expect(hash()).toBe(packLink({ hue: 6 }, spec));
  });

  it('hands a stored state the link at mount when they differ', () => {
    history.replaceState(null, '', `#${packLink({ hue: 33 }, spec)}`);
    const state: Shape = { hue: 1 };
    const seen: Shape[] = [];
    function Stored() {
      useHashLink(state, (next) => seen.push(next), spec);
      return null;
    }
    render(<Stored />);
    expect(seen).toEqual([{ hue: 33 }]);
  });
});
