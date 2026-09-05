import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Slider } from './Slider';

function stubRect(el: Element, rect: Partial<DOMRect> = {}) {
  const full: DOMRect = { x: 0, y: 0, width: 200, height: 24, top: 0, left: 0, right: 200, bottom: 24, toJSON: () => ({}), ...rect };
  (el as HTMLElement).getBoundingClientRect = () => full;
}

describe('Slider rendering', () => {
  it('renders one thumb per item with left% mapped from value', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0 }, { value: 0.5 }, { value: 1 }]}
        onInput={() => {}}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].style.left).toBe('0%');
    expect(thumbs[1].style.left).toBe('50%');
    expect(thumbs[2].style.left).toBe('100%');
  });
});

describe('Slider single-thumb drag', () => {
  it('drags a thumb and emits onInput continuously and onChange on pointerup', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onChange={onChange}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    const trackEl = thumb.parentElement!;
    stubRect(trackEl, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1 });
    expect(onInput).toHaveBeenCalled();
    const lastCallArgs = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(lastCallArgs[0].value).toBeCloseTo(0.75, 2);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, { clientX: 150, clientY: 12, pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].value).toBeCloseTo(0.75, 2);
  });

  it('clamps drag to min/max', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={1} step={0.01} thumbs={[{ value: 0.5 }]} onInput={onInput} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: -50, clientY: 12, pointerId: 1 });
    expect(onInput.mock.calls[onInput.mock.calls.length - 1][0][0].value).toBe(0);

    fireEvent.pointerMove(document, { clientX: 9999, clientY: 12, pointerId: 1 });
    expect(onInput.mock.calls[onInput.mock.calls.length - 1][0][0].value).toBe(1);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('snaps drag to step', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={10} step={1} thumbs={[{ value: 5 }]} onInput={onInput} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 137, clientY: 12, pointerId: 1 }); // ~6.85 → snap to 7
    expect(onInput.mock.calls[onInput.mock.calls.length - 1][0][0].value).toBe(7);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe('Slider keyboard', () => {
  it('arrow right increments by step and fires onInput + onChange', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider min={0} max={10} step={1} thumbs={[{ value: 5 }]} onInput={onInput} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onInput.mock.calls[0][0][0].value).toBe(6);
    expect(onChange.mock.calls[0][0][0].value).toBe(6);
  });

  it('shift+arrow moves by 10 steps; PageUp/Down do the same', () => {
    // Drive a controlled Slider so each keystroke sees the updated value.
    function Harness() {
      const [v, setV] = useState(50);
      return (
        <Slider
          min={0}
          max={100}
          step={1}
          thumbs={[{ value: v }]}
          onInput={ts => setV(ts[0].value)}
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
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={10} step={1} thumbs={[{ value: 5 }]} onInput={onInput} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onInput.mock.calls[0][0][0].value).toBe(0);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onInput.mock.calls[1][0][0].value).toBe(10);
  });

  it('exposes ARIA attributes on each thumb', () => {
    const { container } = render(
      <Slider min={0} max={1} thumbs={[{ value: 0.25 }]} ariaLabel="Hue" onInput={() => {}} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-orientation')).toBe('horizontal');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('1');
    expect(thumb.getAttribute('aria-valuenow')).toBe('0.25');
    expect(thumb.getAttribute('aria-label')).toBe('Hue');
  });
});

describe('Slider free constraint', () => {
  it('thumbs may pass each other; onInput preserves index order', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onInput={onInput}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });

    // Drag thumb 0 (start at 0.3 → x=60) past thumb 1 (at 0.7 → x=140) to x=180 (~0.9).
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1 });
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].value).toBeCloseTo(0.9, 2);
    expect(last[1].value).toBeCloseTo(0.7, 2);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe("Slider 'ordered' constraint", () => {
  it('clamps lower thumb to (lower-neighbor, upper-neighbor − step)', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onInput={onInput}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1 });
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].value).toBeLessThanOrEqual(0.69);
    expect(last[1].value).toBeCloseTo(0.7, 2);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('clamps upper thumb to (lower-neighbor + step, max)', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onInput={onInput}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[1], { clientX: 140, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 12, pointerId: 1 });
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[1].value).toBeGreaterThanOrEqual(0.31);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe("Slider 'ordered' constraint — keyboard", () => {
  it('End stops at the upper neighbor rather than jumping to max', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={1} step={0.01} constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]} onInput={onInput} />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    fireEvent.keyDown(thumbs[0], { key: 'End' });
    expect(onInput.mock.calls[0][0][0].value).toBeCloseTo(0.69, 5);
  });

  it('Home stops at the lower neighbor rather than jumping to min', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={1} step={0.01} constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]} onInput={onInput} />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    fireEvent.keyDown(thumbs[1], { key: 'Home' });
    expect(onInput.mock.calls[0][0][1].value).toBeCloseTo(0.31, 5);
  });

  it('a repeated arrow step cannot push a thumb past its neighbor', () => {
    function Harness() {
      const [thumbs, setThumbs] = useState([{ value: 0.5 }, { value: 0.55 }]);
      return (
        <Slider min={0} max={1} step={0.01} constraint="ordered"
          thumbs={thumbs} onInput={setThumbs} />
      );
    }
    const { container } = render(<Harness />);
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    for (let i = 0; i < 20; i++) fireEvent.keyDown(thumbs[0], { key: 'ArrowRight' });
    const values = Array.from(container.querySelectorAll<HTMLElement>('[role="slider"]'))
      .map((el) => Number(el.getAttribute('aria-valuenow')));
    expect(values[0]).toBeLessThan(values[1]);
  });
});

describe('Slider drag teardown', () => {
  it('pointercancel ends the drag — later moves do not keep dragging the thumb', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={1} thumbs={[{ value: 0.5 }]} onInput={onInput} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 12, pointerId: 1 });
    expect(onInput).toHaveBeenCalledTimes(1);
    fireEvent.pointerCancel(document, { pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1 });
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('unmounting mid-drag detaches the document listeners', () => {
    const { container, unmount } = render(
      <Slider min={0} max={1} thumbs={[{ value: 0.5 }]} onInput={() => {}} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    const remove = vi.spyOn(document, 'removeEventListener');
    unmount();
    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toContain('pointermove');
    expect(removed).toContain('pointerup');
    remove.mockRestore();
  });

  it('a press focuses the thumb so the arrow keys reach it', () => {
    const { container } = render(
      <Slider min={0} max={1} thumbs={[{ value: 0.5 }]} onInput={() => {}} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    expect(document.activeElement).toBe(thumb);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe('Slider per-thumb bounds (tuple form)', () => {
  it('clamps drag to bounds', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3, bounds: [0.1, 0.5] }]}
        onInput={onInput}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 12, pointerId: 1 });
    expect(onInput.mock.calls[onInput.mock.calls.length - 1][0][0].value).toBe(0.1);
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12, pointerId: 1 });
    expect(onInput.mock.calls[onInput.mock.calls.length - 1][0][0].value).toBe(0.5);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('Home snaps to bounds[0]; End snaps to bounds[1]', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3, bounds: [0.1, 0.5] }]}
        onInput={onInput}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onInput.mock.calls[0][0][0].value).toBe(0.1);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onInput.mock.calls[1][0][0].value).toBe(0.5);
  });
});

describe('Slider per-thumb bounds (callback form)', () => {
  it('callback receives the in-flight thumb buffer and clamps using neighbor values', () => {
    const onInput = vi.fn();
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
      <Slider min={0} max={1} step={0.01} thumbs={thumbsProp} onInput={onInput} />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12, pointerId: 1 });
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last[0].value).toBeCloseTo(0.65, 2); // 0.7 − 0.05
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});

describe('Slider click-on-track to add', () => {
  it('appends thumb returned by onAddThumb on track click', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const onAddThumb = vi.fn((at: number) => ({ value: Math.round(at * 100) / 100 }));
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onChange={onChange}
        onAddThumb={onAddThumb}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(0.25);
    expect(onInput.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
    expect(onChange.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
  });

  it('null return is a no-op', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onAddThumb={() => null}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onInput).not.toHaveBeenCalled();
  });
});

describe('Slider remove (drag-off and right-click)', () => {
  it('drag-off-vertical removes thumb on pointerup if onRemoveThumb returns true', () => {
    const onInput = vi.fn();
    const onRemoveThumb = vi.fn(() => true);
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onInput={onInput}
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
    const last = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(last).toEqual([{ value: 0.7 }]);
  });

  it('right-click on thumb removes via onRemoveThumb', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onInput={onInput}
        onRemoveThumb={() => true}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    fireEvent.contextMenu(thumbs[1]);
    expect(onInput.mock.calls[0][0]).toEqual([{ value: 0.3 }]);
  });

  it('onRemoveThumb returning false leaves thumbs intact', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onRemoveThumb={() => false}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.contextMenu(thumb);
    expect(onInput).not.toHaveBeenCalled();
  });
});

describe('Slider allowShiftAll', () => {
  it('shift-drag moves all thumbs by the same delta clamped to [min, max]', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.2 }, { value: 0.5 }, { value: 0.8 }]}
        onInput={onInput}
        allowShiftAll
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[1].parentElement!, { left: 0, width: 200 });

    // Pointer starts at thumb[1]'s center (x=100, value=0.5). Drag right by +30 px → +0.15 delta.
    fireEvent.pointerDown(thumbs[1], { clientX: 100, clientY: 12, pointerId: 1, button: 0, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 130, clientY: 12, pointerId: 1, shiftKey: true });
    const after = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(after[0].value).toBeCloseTo(0.35, 2);
    expect(after[1].value).toBeCloseTo(0.65, 2);
    expect(after[2].value).toBeCloseTo(0.95, 2);
    fireEvent.pointerUp(document, { pointerId: 1, shiftKey: true });
  });

  it('clamps the shift-drag delta so no thumb crosses max', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.2 }, { value: 0.5 }, { value: 0.9 }]}
        onInput={onInput}
        allowShiftAll
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[2].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[2], { clientX: 180, clientY: 12, pointerId: 1, button: 0, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 240, clientY: 12, pointerId: 1, shiftKey: true });
    // Requested delta = +0.30 px-fraction, but max delta = 1 − 0.9 = 0.1.
    const after = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(after[0].value).toBeCloseTo(0.3, 2);
    expect(after[1].value).toBeCloseTo(0.6, 2);
    expect(after[2].value).toBeCloseTo(1.0, 2);
    fireEvent.pointerUp(document, { pointerId: 1, shiftKey: true });
  });
});

describe('Slider renderTrack', () => {
  it('invokes renderTrack with a TrackCtx and renders its output behind thumbs', () => {
    const renderTrack = vi.fn((_ctx: { trackWidth: number; valueToFraction: (v: number) => number }) => <div data-testid="custom-track">painted</div>);
    const { getByTestId } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onInput={() => {}}
        renderTrack={renderTrack}
      />,
    );
    expect(renderTrack).toHaveBeenCalled();
    const arg = renderTrack.mock.calls[0]![0];
    expect(typeof arg.valueToFraction).toBe('function');
    expect(arg.valueToFraction(0.5)).toBeCloseTo(0.5, 5);
    expect(getByTestId('custom-track')).toBeTruthy();
  });
});

describe('Slider thumb shape variants', () => {
  it('shape="notched" renders the notched class', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: 'notched' }]}
        onInput={() => {}}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.className).toContain('notched');
  });

  it('shape={ render } uses the custom render', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: { render: () => <span data-testid="x">X</span> } }]}
        onInput={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="x"]')).toBeTruthy();
  });
});

describe('Slider readouts', () => {
  it("'inline-after' renders one entry per thumb after the track", () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.123 }, { value: 0.456 }]}
        readoutPlacement="inline-after"
        onInput={() => {}}
      />,
    );
    const inline = container.querySelector('[data-readout="inline"]')!;
    expect(inline.textContent).toContain('0.123');
    expect(inline.textContent).toContain('0.456');
  });

  it("'below-thumb' renders one absolutely-positioned readout per thumb", () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.25 }, { value: 0.75 }]}
        readoutPlacement="below-thumb"
        onInput={() => {}}
      />,
    );
    const readouts = container.querySelectorAll<HTMLElement>('[data-readout="below"]');
    expect(readouts).toHaveLength(2);
    expect(readouts[0].style.left).toBe('25%');
    expect(readouts[1].style.left).toBe('75%');
  });

  it('renderReadout overrides default formatting', () => {
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        readoutPlacement="inline-after"
        renderReadout={(t) => `[${t.value}]`}
        onInput={() => {}}
      />,
    );
    expect(container.querySelector('[data-readout="inline"]')!.textContent).toContain('[0.5]');
  });
});

describe('Slider stops', () => {
  const renderWithStops = (props: Partial<Parameters<typeof Slider>[0]> = {}) => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={100}
        stops={[0, 25, 50, 75, 100]}
        thumbs={[{ value: 10 }]}
        onInput={onInput}
        onChange={onChange}
        {...props}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement as HTMLElement, { left: 0, width: 200 });
    return { thumb, onInput, onChange };
  };

  const lastValue = (fn: ReturnType<typeof vi.fn>) =>
    fn.mock.calls[fn.mock.calls.length - 1][0][0].value;

  it('lands a drag on a stop it passes near', () => {
    const { thumb, onInput } = renderWithStops();
    fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
    // 98px of a 200px track over [0, 100] is 49 — within the snap radius of 50.
    fireEvent.pointerMove(document, { clientX: 98, clientY: 12 });
    expect(lastValue(onInput)).toBe(50);
  });

  it('leaves a drag far from every stop alone', () => {
    const { thumb, onInput } = renderWithStops();
    fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
    // 75px is 37.5 — a full 12.5 from either neighbouring stop.
    fireEvent.pointerMove(document, { clientX: 75, clientY: 12 });
    expect(lastValue(onInput)).toBeCloseTo(37.5, 5);
  });

  it('ignores a stop outside the range', () => {
    const { thumb, onInput } = renderWithStops({ stops: [-40, 48, 140] });
    fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 98, clientY: 12 });
    expect(lastValue(onInput)).toBe(48);

    fireEvent.pointerMove(document, { clientX: 280, clientY: 12 });
    expect(lastValue(onInput)).toBe(100);
  });

  it('snaps a thumb added by clicking the track', () => {
    const onAddThumb = vi.fn((v: number) => ({ value: v }));
    const { thumb, onInput } = renderWithStops({ onAddThumb });
    fireEvent.pointerDown(thumb.parentElement as HTMLElement, { clientX: 98, clientY: 12, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(50);
    const added = onInput.mock.calls[onInput.mock.calls.length - 1][0];
    expect(added[added.length - 1].value).toBe(50);
  });

  it('still quantizes to step between stops', () => {
    const { thumb, onInput } = renderWithStops({ step: 10 });
    fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
    // 75px is 37.5, which step 10 quantizes to 40 — not near enough to a stop to move again.
    fireEvent.pointerMove(document, { clientX: 75, clientY: 12 });
    expect(lastValue(onInput)).toBe(40);
  });

  it('keeps a stop inside a thumb bound', () => {
    const { thumb, onInput } = renderWithStops({ thumbs: [{ value: 10, bounds: [0, 40] }] });
    fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 98, clientY: 12 });
    expect(lastValue(onInput)).toBe(40);
  });

  it('steps an arrow key from stop to stop', () => {
    const { thumb, onInput } = renderWithStops({ thumbs: [{ value: 50 }] });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(lastValue(onInput)).toBe(75);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(lastValue(onInput)).toBe(25);
  });

  it('moves an arrow key off an in-between value onto the neighbouring stop', () => {
    const { thumb, onInput } = renderWithStops({ thumbs: [{ value: 30 }] });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(lastValue(onInput)).toBe(50);
  });

  it('holds the last stop at the end of the list', () => {
    const { thumb, onInput } = renderWithStops({ thumbs: [{ value: 100 }] });
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(lastValue(onInput)).toBe(100);
  });

  it('jumps a coarse keystroke ten stops', () => {
    const { thumb, onInput } = renderWithStops({ thumbs: [{ value: 0 }] });
    fireEvent.keyDown(thumb, { key: 'PageUp' });
    expect(lastValue(onInput)).toBe(100);
  });

  it('leaves Home and End on the bounds', () => {
    const { thumb, onInput } = renderWithStops({ thumbs: [{ value: 50 }] });
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(lastValue(onInput)).toBe(0);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(lastValue(onInput)).toBe(100);
  });

  it('does not snap when no stops are given', () => {
    const { thumb, onInput } = renderWithStops({ stops: undefined });
    fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 98, clientY: 12 });
    expect(lastValue(onInput)).toBeCloseTo(49, 5);
  });
});

describe('Slider stop marks', () => {
  const ticksOf = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('[data-slider-tick]'));

  it('draws one mark per stop', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={[0, 25, 50, 75, 100]} thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    expect(ticksOf(container)).toHaveLength(5);
  });

  // jsdom lays nothing out, so the mark's *position* is only assertable as the
  // fraction the component computed for it — the geometry is checked visually.
  it('places each mark at the stop fraction', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={[0, 25, 50, 75, 100]} thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    expect(ticksOf(container).map(t => t.dataset.fraction)).toEqual(['0', '0.25', '0.5', '0.75', '1']);
    expect(ticksOf(container).map(t => t.style.left)).toEqual(['0%', '25%', '50%', '75%', '100%']);
  });

  it('draws nothing when there are no stops', () => {
    const { container } = render(<Slider min={0} max={1} thumbs={[{ value: 0.5 }]} onInput={() => {}} />);
    expect(ticksOf(container)).toHaveLength(0);
  });

  it('omits stops the range excludes, matching what a drag can reach', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={[-40, 50, 140]} thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    expect(ticksOf(container).map(t => t.dataset.fraction)).toEqual(['0.5']);
  });

  it('hides the marks when showStops is off', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={[0, 50, 100]} thumbs={[{ value: 10 }]} showStops={false} onInput={() => {}} />,
    );
    expect(ticksOf(container)).toHaveLength(0);
  });

  it('keeps the marks out of the accessibility tree and out of hit testing', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={[0, 50, 100]} thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    const marks = container.querySelector('[data-slider-ticks]') as HTMLElement;
    expect(marks.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not let a mark swallow a track click that would add a thumb', () => {
    const onAddThumb = vi.fn((v: number) => ({ value: v }));
    const { container } = render(
      <Slider min={0} max={100} stops={[0, 50, 100]} thumbs={[{ value: 10 }]} onAddThumb={onAddThumb} onInput={() => {}} />,
    );
    const track = container.querySelector('[data-slider-ticks]')!.parentElement as HTMLElement;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(50);
  });
});

describe('Slider value text', () => {
  it('publishes a thumb valueText as aria-valuetext', () => {
    const { container } = render(
      <Slider min={0} max={4} thumbs={[{ value: 2, valueText: '1x' }]} onInput={() => {}} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-valuetext')).toBe('1x');
  });

  it('leaves aria-valuetext off when a thumb has none', () => {
    const { container } = render(<Slider min={0} max={1} thumbs={[{ value: 0.5 }]} onInput={() => {}} />);
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.hasAttribute('aria-valuetext')).toBe(false);
  });
});

describe('Slider track click', () => {
  const renderTrackClick = (props: Partial<Parameters<typeof Slider>[0]> = {}) => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={100}
        thumbs={[{ value: 10 }]}
        trackClick="move-nearest"
        onInput={onInput}
        onChange={onChange}
        {...props}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    const track = thumb.parentElement as HTMLElement;
    stubRect(track, { left: 0, width: 200 });
    return { track, thumb, onInput, onChange };
  };

  const lastValues = (fn: ReturnType<typeof vi.fn>): number[] =>
    fn.mock.calls[fn.mock.calls.length - 1][0].map((t: { value: number }) => t.value);

  it('ignores a track click by default', () => {
    const { track, onInput } = renderTrackClick({ trackClick: undefined });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onInput).not.toHaveBeenCalled();
  });

  it('moves the only thumb to the clicked value', () => {
    const { track, onInput } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([50]);
  });

  it('moves the nearest thumb, leaving the others alone', () => {
    const { track, onInput } = renderTrackClick({ thumbs: [{ value: 10 }, { value: 90 }] });
    fireEvent.pointerDown(track, { clientX: 160, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([10, 80]);
  });

  it('lands the click on a stop', () => {
    const { track, onInput } = renderTrackClick({ stops: [0, 50, 100] });
    fireEvent.pointerDown(track, { clientX: 98, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([50]);
  });

  it('commits on release, not on the press', () => {
    const { track, onInput, onChange } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onInput).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(document, { clientX: 100, clientY: 12 });
    expect(lastValues(onChange)).toEqual([50]);
  });

  // The press seeds the drag it starts. Without that seed the buffer still
  // holds the pre-click value and a release with no movement commits it,
  // silently undoing the click.
  it('keeps the clicked value when the release follows with no movement', () => {
    const { track, onChange } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 12 });
    expect(lastValues(onChange)).toEqual([50]);
  });

  it('drags on from where the click landed', () => {
    const { track, onInput } = renderTrackClick();
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12 });
    expect(lastValues(onInput)).toEqual([75]);
  });

  it('lets onAddThumb win over the move', () => {
    const onAddThumb = vi.fn((v: number) => ({ value: v }));
    const { track, onInput } = renderTrackClick({ onAddThumb });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(50);
    expect(lastValues(onInput)).toEqual([10, 50]);
  });

  it('holds the moved thumb inside its bounds', () => {
    const { track, onInput } = renderTrackClick({ thumbs: [{ value: 10, bounds: [0, 30] }] });
    fireEvent.pointerDown(track, { clientX: 100, clientY: 12, button: 0 });
    expect(lastValues(onInput)).toEqual([30]);
  });
});

describe('Slider pointer session', () => {
  function dragging() {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider min={0} max={100} thumbs={[{ value: 50 }]} onInput={onInput} onChange={onChange} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0, buttons: 1 });
    return { thumb, onInput, onChange };
  }

  it('commits a release that lands outside the slider', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const { onChange } = dragging();
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(outside, { clientX: 400, clientY: 900, pointerId: 1, bubbles: true });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].value).toBeCloseTo(75, 5);
    outside.remove();
  });

  it('cancels the drag when the thumb loses pointer capture', () => {
    const { thumb, onInput, onChange } = dragging();
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1, buttons: 1 });
    expect(onInput).toHaveBeenCalledTimes(1);
    fireEvent(thumb, new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1, buttons: 1 });
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats a move with no button held as the release it missed', () => {
    const { onInput, onChange } = dragging();
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1, buttons: 0 });
    expect(onChange).toHaveBeenCalledTimes(1);
    // The button-less move is the release, not a drag step: it must not move the thumb.
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].value).toBeCloseTo(75, 5);
  });

  it('ends a shift-all drag on the release it missed', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider min={0} max={100} thumbs={[{ value: 20 }, { value: 60 }]} allowShiftAll onInput={() => {}} onChange={onChange} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0, buttons: 1, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 12, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 140, clientY: 12, pointerId: 1, buttons: 0 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((t: { value: number }) => t.value)).toEqual([30, 70]);
  });
});

// PROXY ASSERTION — see Ruler.test.tsx for why this is asserted rather than the
// browser behaviour it stands in for. A custom thumb shape may render
// interactive content, and capture would kill the click on it.
describe('Slider pointer capture', () => {
  it('never captures the pointer', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    const { container } = render(
      <Slider min={0} max={100} thumbs={[{ value: 50 }]} onInput={() => {}} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 150, clientY: 12, pointerId: 1 });
    expect(capture).not.toHaveBeenCalled();
  });
});
