import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Slider } from './Slider';
import { stubRect } from './testing/stubRect';

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
