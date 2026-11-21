import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
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
