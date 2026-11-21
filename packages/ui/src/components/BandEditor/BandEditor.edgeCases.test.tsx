import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { fraction, percent, tag, type Tagged } from '@weasel-js/quantity';
import { BandEditor } from './BandEditor';
import type { Band } from './bands';

const BANDS: Band<string>[] = [{ from: 0, data: 'a' }, { from: 20, data: 'b' }, { from: 60, data: 'c' }];

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 40, width: 400, height: 40, toJSON: () => {} } as DOMRect;
  };
});

describe('an empty value', () => {
  it('draws an empty strip rather than throwing', () => {
    const { container } = render(
      <BandEditor<string> value={[]} min={0} max={100} scale="linear" onChange={vi.fn()} onRangeChange={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-band-index]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-range-edge]')).toHaveLength(2);
  });
});

describe('a caller previewing an edge drag', () => {
  /** Writes each live range and its bands back as its props, as an undo-backed caller does. */
  function Previewing() {
    const [state, setState] = useState({ min: 0, max: 100, bands: BANDS });
    return (
      <BandEditor
        value={state.bands}
        min={state.min}
        max={state.max}
        scale="linear"
        onChange={vi.fn()}
        onRangeInput={(min, max, bands) => setState({ min, max, bands })}
        onRangeChange={(min, max, bands) => setState({ min, max, bands })}
      />
    );
  }

  it('keeps an end pulled inward under the pointer, drawn against the axis the drag began on', () => {
    const { container } = render(<Previewing />);
    const max = container.querySelector<HTMLElement>('[data-range-edge="max"]')!;
    fireEvent.pointerDown(max, { clientX: 400, clientY: 20, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 20 });
    expect(max.style.getPropertyValue('--be-at')).toBe('50%');
    fireEvent.pointerMove(document, { clientX: 300, clientY: 20 });
    expect(max.style.getPropertyValue('--be-at')).toBe('75%');
    expect(container.querySelector<HTMLElement>('[data-band-strip]')!.style.getPropertyValue('--be-to')).toBe('75%');
  });
});

describe('a range end on the keyboard', () => {
  it('steps ten on PageUp and PageDown, as the seams beside it do', () => {
    const onRangeChange = vi.fn();
    const { container } = render(
      <BandEditor value={BANDS} min={0} max={100} scale="linear" onChange={vi.fn()} onRangeChange={onRangeChange} />,
    );
    fireEvent.keyDown(container.querySelector('[data-range-edge="max"]')!, { key: 'PageUp' });
    fireEvent.keyDown(container.querySelector('[data-range-edge="min"]')!, { key: 'PageDown' });
    const ends = onRangeChange.mock.calls.map(([lo, hi]) => [lo, hi].map((v: number) => Math.round(v * 1e9) / 1e9));
    expect(ends).toEqual([[0, 110], [-10, 100]]);
  });

  it('sends an end with nothing locked to one step short of the other end on Home and End, the bound it announces', () => {
    const onRangeChange = vi.fn();
    const { container } = render(
      <BandEditor value={BANDS} min={0} max={100} scale="linear" onChange={vi.fn()} onRangeChange={onRangeChange} />,
    );
    const max = container.querySelector<HTMLElement>('[data-range-edge="max"]')!;
    const min = container.querySelector<HTMLElement>('[data-range-edge="min"]')!;
    expect([max.getAttribute('aria-valuemin'), min.getAttribute('aria-valuemax')]).toEqual(['1', '99']);
    fireEvent.keyDown(max, { key: 'Home' });
    fireEvent.keyDown(min, { key: 'End' });
    expect(onRangeChange.mock.calls.map(([lo, hi]) => [lo, hi])).toEqual([[0, 1], [99, 100]]);
  });
});

describe('an edge drag near a tick', () => {
  it('snaps to a tick past the current range, at its own place on the track', () => {
    const onRangeChange = vi.fn();
    const { container } = render(
      <BandEditor
        value={BANDS} min={0} max={100} scale="linear" ticks={[{ at: 50 }, { at: 120 }]}
        onChange={vi.fn()} onRangeChange={onRangeChange}
      />,
    );
    const max = container.querySelector('[data-range-edge="max"]')!;
    fireEvent.pointerDown(max, { clientX: 400, clientY: 20, button: 0 });
    fireEvent.pointerMove(document, { clientX: 478, clientY: 20 });
    fireEvent.pointerUp(document, { clientX: 478, clientY: 20 });
    expect(onRangeChange.mock.calls[0]!.slice(0, 2)).toEqual([0, 120]);
  });
});

describe('tags through a split or a merge', () => {
  const mixed = (data: [string, string]): Band<string, Tagged>[] => [
    { from: tag(0, fraction()), data: data[0] },
    { from: tag(1 / 2, percent()), data: data[1] },
  ];
  const kinds = (next: Band<string, Tagged>[]) => next.map((b) => b.from.display?.kind);
  const splitAt = (container: HTMLElement, x: number) =>
    fireEvent.pointerDown(container.querySelector('[data-band-ruler]')!, { clientX: x, clientY: 20, button: 0 });

  it("gives a band split off with fresh data its parent's tag", () => {
    const onChange = vi.fn();
    const { container } = render(
      <BandEditor<string, Tagged> value={mixed(['a', 'b'])} min={0} max={1} scale="linear"
        splitBand={() => 'new'} onChange={onChange} />,
    );
    splitAt(container, 300);
    expect(kinds(onChange.mock.calls[0]![0])).toEqual(['fraction', 'percent', 'percent']);
  });

  it('keeps each band its own tag when bands share a payload', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BandEditor<string, Tagged> value={mixed(['p', 'p'])} min={0} max={1} scale="linear" onChange={onChange} />,
    );
    splitAt(container, 300);
    expect(kinds(onChange.mock.calls[0]![0])).toEqual(['fraction', 'percent', 'percent']);
  });

  it('keeps the tags of the bands a merge leaves', () => {
    const onChange = vi.fn();
    const value: Band<string, Tagged>[] = [
      { from: tag(0, fraction()), data: 'p' },
      { from: tag(1 / 2, fraction()), data: 'p' },
      { from: tag(3 / 4, percent()), data: 'p' },
    ];
    const { container } = render(
      <BandEditor<string, Tagged> value={value} min={0} max={1} scale="linear" selectedIndex={1} onChange={onChange} />,
    );
    fireEvent.keyDown(container.querySelector('[data-band-index="1"]')!, { key: 'Delete' });
    const next = onChange.mock.calls[0]![0] as Band<string, Tagged>[];
    expect(kinds(next)).toEqual(['fraction', 'percent']);
    expect(next[1]!.from.value).toBe(3 / 4);
  });
});
