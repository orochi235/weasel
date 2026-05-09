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

describe('RangePicker per-thumb bounds (tuple form)', () => {
  it('clamps drag to bounds', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3, bounds: [0.1, 0.5] }]}
        onChange={onChange}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(0.1);
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(0.5);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('Home snaps to bounds[0]; End snaps to bounds[1]', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3, bounds: [0.1, 0.5] }]}
        onChange={onChange}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onChange.mock.calls[0][0][0].value).toBe(0.1);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onChange.mock.calls[1][0][0].value).toBe(0.5);
  });
});

describe('RangePicker per-thumb bounds (callback form)', () => {
  it('callback receives the in-flight thumb buffer and clamps using neighbor values', () => {
    const onChange = vi.fn();
    // Two thumbs; thumb 0 cannot exceed thumb 1's value − 0.05.
    const thumbsProp = [
      {
        value: 0.3,
        bounds: ({ thumbs }: { thumbs: readonly { value: number }[]; index: number }) =>
          [0, thumbs[1].value - 0.05] as [number, number],
      },
      { value: 0.7 },
    ];
    const { container } = render(
      <RangePicker min={0} max={1} step={0.01} thumbs={thumbsProp} onChange={onChange} />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].value).toBeCloseTo(0.65, 2); // 0.7 − 0.05
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe('RangePicker click-on-track to add', () => {
  it('appends thumb returned by onAddThumb on track click', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onAddThumb = vi.fn((at: number) => ({ value: Math.round(at * 100) / 100 }));
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onCommit={onCommit}
        onAddThumb={onAddThumb}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(0.25);
    expect(onChange.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
    expect(onCommit.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
  });

  it('null return is a no-op', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onAddThumb={() => null}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('RangePicker remove (drag-off and right-click)', () => {
  it('drag-off-vertical removes thumb on pointerup if onRemoveThumb returns true', () => {
    const onChange = vi.fn();
    const onRemoveThumb = vi.fn(() => true);
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
        onRemoveThumb={onRemoveThumb}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200, top: 0, bottom: 24, height: 24 });

    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    // Drag well below the track band — y > top + height + trackHeight (24 + 24 = 48).
    fireEvent.pointerMove(document, { clientX: 60, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 60, clientY: 100, pointerId: 1 });
    expect(onRemoveThumb).toHaveBeenCalledWith(0);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toEqual([{ value: 0.7 }]);
  });

  it('right-click on thumb removes via onRemoveThumb', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
        onRemoveThumb={() => true}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    fireEvent.contextMenu(thumbs[1]);
    expect(onChange.mock.calls[0][0]).toEqual([{ value: 0.3 }]);
  });

  it('onRemoveThumb returning false leaves thumbs intact', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onRemoveThumb={() => false}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.contextMenu(thumb);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('RangePicker allowShiftAll', () => {
  it('shift-drag moves all thumbs by the same delta clamped to [min, max]', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.2 }, { value: 0.5 }, { value: 0.8 }]}
        onChange={onChange}
        allowShiftAll
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[1].parentElement!, { left: 0, width: 200 });

    // Pointer starts at thumb[1]'s center (x=100, value=0.5). Drag right by +30 px → +0.15 delta.
    fireEvent.pointerDown(thumbs[1], { clientX: 100, clientY: 12, pointerId: 1, button: 0, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 130, clientY: 12, pointerId: 1, shiftKey: true });
    const after = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(after[0].value).toBeCloseTo(0.35, 2);
    expect(after[1].value).toBeCloseTo(0.65, 2);
    expect(after[2].value).toBeCloseTo(0.95, 2);
    fireEvent.pointerUp(document, { pointerId: 1, shiftKey: true });
  });

  it('clamps the shift-drag delta so no thumb crosses max', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.2 }, { value: 0.5 }, { value: 0.9 }]}
        onChange={onChange}
        allowShiftAll
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[2].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[2], { clientX: 180, clientY: 12, pointerId: 1, button: 0, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 240, clientY: 12, pointerId: 1, shiftKey: true });
    // Requested delta = +0.30 px-fraction, but max delta = 1 − 0.9 = 0.1.
    const after = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(after[0].value).toBeCloseTo(0.3, 2);
    expect(after[1].value).toBeCloseTo(0.6, 2);
    expect(after[2].value).toBeCloseTo(1.0, 2);
    fireEvent.pointerUp(document, { pointerId: 1, shiftKey: true });
  });
});

describe('RangePicker renderTrack', () => {
  it('invokes renderTrack with a TrackCtx and renders its output behind thumbs', () => {
    const renderTrack = vi.fn(() => <div data-testid="custom-track">painted</div>);
    const { getByTestId } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onChange={() => {}}
        renderTrack={renderTrack}
      />,
    );
    expect(renderTrack).toHaveBeenCalled();
    const arg = renderTrack.mock.calls[0][0];
    expect(typeof arg.valueToFraction).toBe('function');
    expect(arg.valueToFraction(0.5)).toBeCloseTo(0.5, 5);
    expect(getByTestId('custom-track')).toBeTruthy();
  });
});

describe('RangePicker thumb shape variants', () => {
  it('shape="notched" renders the notched class', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: 'notched' }]}
        onChange={() => {}}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.className).toContain('notched');
  });

  it('shape={ render } uses the custom render', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: { render: () => <span data-testid="x">X</span> } }]}
        onChange={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="x"]')).toBeTruthy();
  });
});
