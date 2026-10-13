import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';
import { stubRect } from './testing/stubRect';

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

  it('keeps dragging when capture is lost and the thumb is still in the document', () => {
    const { thumb, onInput } = dragging();
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1, buttons: 1 });
    expect(onInput).toHaveBeenCalledTimes(1);
    // Chrome releases capture a beat before it delivers pointerup, so ending
    // here throws away a release that has already been dispatched. The other
    // half of the rule — a detached origin does cancel — belongs to
    // pointerSession.test.ts, which owns it without React in the way.
    fireEvent(thumb, new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true }));
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1, buttons: 1 });
    expect(onInput).toHaveBeenCalledTimes(2);
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
