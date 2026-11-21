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
