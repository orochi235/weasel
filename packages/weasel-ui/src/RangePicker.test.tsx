import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { RangePicker } from './RangePicker';

// jsdom omits PointerEvent. Without this shim, fireEvent.pointerDown/Move/Up dispatch
// a plain Event with no clientX/clientY/button, which breaks every drag test below.
// Aliasing PointerEvent to MouseEvent makes fireEvent construct a MouseEvent with the
// init dictionary applied (clientX/clientY/button/etc).
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  class PolyfillPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  }
  (globalThis as { PointerEvent?: unknown }).PointerEvent = PolyfillPointerEvent;
}

function stubRect(el: Element, rect: Partial<DOMRect> = {}) {
  const full: DOMRect = { x: 0, y: 0, width: 200, height: 24, top: 0, left: 0, right: 200, bottom: 24, toJSON: () => ({}), ...rect };
  (el as HTMLElement).getBoundingClientRect = () => full;
}

describe('RangePicker rendering', () => {
  it('renders one thumb per item with left% mapped from value', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0 }, { value: 0.5 }, { value: 1 }]}
        onChange={() => {}}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].style.left).toBe('0%');
    expect(thumbs[1].style.left).toBe('50%');
    expect(thumbs[2].style.left).toBe('100%');
  });
});

describe('RangePicker single-thumb drag', () => {
  it('drags a thumb and emits onChange continuously and onCommit on pointerup', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    const trackEl = thumb.parentElement!;
    stubRect(trackEl, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    const lastCallArgs = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCallArgs[0].value).toBeCloseTo(0.75, 2);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, { clientX: 150, clientY: 12, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0][0].value).toBeCloseTo(0.75, 2);
  });

  it('clamps drag to min/max', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={1} step={0.01} thumbs={[{ value: 0.5 }]} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: -50, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(0);

    fireEvent.pointerMove(document, { clientX: 9999, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(1);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('snaps drag to step', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={10} step={1} thumbs={[{ value: 5 }]} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 137, clientY: 12, pointerId: 1 }); // ~6.85 → snap to 7
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(7);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe('RangePicker keyboard', () => {
  it('arrow right increments by step and fires onChange + onCommit', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={10} step={1} thumbs={[{ value: 5 }]} onChange={onChange} onCommit={onCommit} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange.mock.calls[0][0][0].value).toBe(6);
    expect(onCommit.mock.calls[0][0][0].value).toBe(6);
  });

  it('shift+arrow moves by 10 steps; PageUp/Down do the same', () => {
    // Drive a controlled RangePicker so each keystroke sees the updated value.
    function Harness() {
      const [v, setV] = useState(50);
      return (
        <RangePicker
          min={0}
          max={100}
          step={1}
          thumbs={[{ value: v }]}
          onChange={ts => setV(ts[0].value)}
        />
      );
    }
    const { container } = render(<Harness />);
    let thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight', shiftKey: true });
    thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-valuenow')).toBe('60');
    fireEvent.keyDown(thumb, { key: 'PageDown' });
    thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-valuenow')).toBe('50');
  });

  it('Home snaps to min, End snaps to max', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={10} step={1} thumbs={[{ value: 5 }]} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onChange.mock.calls[0][0][0].value).toBe(0);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onChange.mock.calls[1][0][0].value).toBe(10);
  });

  it('exposes ARIA attributes on each thumb', () => {
    const { container } = render(
      <RangePicker min={0} max={1} thumbs={[{ value: 0.25 }]} ariaLabel="Hue" onChange={() => {}} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-orientation')).toBe('horizontal');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('1');
    expect(thumb.getAttribute('aria-valuenow')).toBe('0.25');
    expect(thumb.getAttribute('aria-label')).toBe('Hue');
  });
});

describe('RangePicker free constraint', () => {
  it('thumbs may pass each other; onChange preserves index order', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });

    // Drag thumb 0 (start at 0.3 → x=60) past thumb 1 (at 0.7 → x=140) to x=180 (~0.9).
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].value).toBeCloseTo(0.9, 2);
    expect(last[1].value).toBeCloseTo(0.7, 2);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe("RangePicker 'ordered' constraint", () => {
  it('clamps lower thumb to (lower-neighbor, upper-neighbor − step)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].value).toBeLessThanOrEqual(0.69);
    expect(last[1].value).toBeCloseTo(0.7, 2);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('clamps upper thumb to (lower-neighbor + step, max)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[1], { clientX: 140, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[1].value).toBeGreaterThanOrEqual(0.31);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});
