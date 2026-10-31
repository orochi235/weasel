import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';
import { logScale } from './scale';
import { stubRect } from './testing/stubRect';
import type { BoundsCtx, Thumb } from './types';

const between = ({ thumbs, index }: BoundsCtx): [number, number] => [thumbs[index - 1]?.value ?? 0, thumbs[index + 1]?.value ?? 100];

function setup(extra: Partial<Parameters<typeof Slider>[0]> = {}) {
  const onInput = vi.fn();
  const onChange = vi.fn();
  const onCancel = vi.fn();
  const thumbs: Thumb[] = [{ value: 20, bounds: between }, { value: 60, bounds: between }];
  const view = render(
    <Slider
      min={0}
      max={100}
      thumbFit="overhang"
      thumbs={thumbs}
      renderRegion={({ index, from, to }) => <span data-testid={`r${index}`}>{`${from}–${to}`}</span>}
      regionDrag
      onInput={onInput}
      onChange={onChange}
      onCancel={onCancel}
      {...extra}
    />,
  );
  const rail = view.container.querySelector<HTMLElement>('[data-slider-rail]')!;
  stubRect(rail, { left: 0, width: 400 });
  const region = (i: number) => view.container.querySelector<HTMLElement>(`[data-slider-region="${i}"]`)!;
  return { ...view, onInput, onChange, onCancel, region };
}

const values = (fn: ReturnType<typeof vi.fn>, call = -1) => fn.mock.calls.at(call)![0].map((t: Thumb) => Math.round(t.value * 1e6) / 1e6);

describe('Slider regions', () => {
  it('draws one region per stretch between thumbs, ends included, each told its values', () => {
    const { region, getByTestId } = setup();
    expect(getByTestId('r0').textContent).toBe('0–20');
    expect(getByTestId('r1').textContent).toBe('20–60');
    expect(getByTestId('r2').textContent).toBe('60–100');
    expect([region(1).style.left, region(1).style.right]).toEqual(['20%', '40%']);
  });

  it('puts each region in the tab order between the thumbs either side of it', () => {
    const { container } = setup({ renderRegion: ({ index }) => <button type="button">{`region ${index}`}</button> });
    const order = [...container.querySelectorAll('button, [role="slider"]')].map((el) => el.textContent || el.getAttribute('aria-valuenow'));
    expect(order).toEqual(['region 0', '20', 'region 1', '60', 'region 2']);
  });

  it('drags an inner region, moving both its thumbs, and commits once', () => {
    const { region, onInput, onChange } = setup();
    fireEvent.pointerDown(region(1), { clientX: 160, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12 });
    expect(values(onInput)).toEqual([30, 70]);
    fireEvent.pointerUp(document, { clientX: 200, clientY: 12 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(values(onChange)).toEqual([30, 70]);
  });

  it('stops a region where a thumb meets the track end or its bound', () => {
    const { region, onChange } = setup();
    fireEvent.pointerDown(region(1), { clientX: 160, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 1000, clientY: 12 });
    fireEvent.pointerUp(document, { clientX: 1000, clientY: 12 });
    expect(values(onChange)).toEqual([60, 100]);
  });

  it('leaves a press that never passes the drag threshold as a click, and an end region where it is', () => {
    const { region, onInput, onChange } = setup();
    fireEvent.pointerDown(region(1), { clientX: 160, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 161, clientY: 12 });
    fireEvent.pointerUp(document, { clientX: 161, clientY: 12 });
    fireEvent.pointerDown(region(0), { clientX: 40, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12 });
    fireEvent.pointerUp(document, { clientX: 200, clientY: 12 });
    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not take a region press as a track press', () => {
    const onAddThumb = vi.fn(() => ({ value: 40 }));
    const { region } = setup({ onAddThumb });
    fireEvent.pointerDown(region(1), { clientX: 160, clientY: 12, button: 0 });
    fireEvent.pointerUp(document, { clientX: 160, clientY: 12 });
    expect(onAddThumb).not.toHaveBeenCalled();
  });

  it('reports a canceled region drag through onCancel, committing nothing', () => {
    const { region, onChange, onCancel } = setup();
    fireEvent.pointerDown(region(1), { clientX: 160, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12 });
    fireEvent.pointerCancel(document, {});
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a canceled thumb drag through onCancel', () => {
    const { container, onCancel } = setup();
    fireEvent.pointerDown(container.querySelector('[role="slider"]')!, { clientX: 80, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 12 });
    fireEvent.pointerCancel(document, {});
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Slider scale', () => {
  it('places thumbs and reads drags through a log scale', () => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={1} max={100} scale={logScale} thumbFit="overhang" thumbs={[{ value: 10 }]} onInput={onInput} />,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    expect(thumb.style.left).toBe('50%');
    stubRect(container.querySelector('[data-slider-rail]')!, { left: 0, width: 400 });
    fireEvent.pointerDown(thumb, { clientX: 200, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 12 });
    expect(onInput.mock.calls.at(-1)![0][0].value).toBeCloseTo(Math.sqrt(1000), 6);
    fireEvent.pointerUp(document, {});
  });
});

describe('Slider stop snap', () => {
  function dragTo(x: number, init: { altKey?: boolean; stopSnapPx?: number } = {}) {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={100} stops={[25]} stopSnapPx={init.stopSnapPx} thumbFit="overhang" thumbs={[{ value: 10 }]} onInput={onInput} />,
    );
    stubRect(container.querySelector('[data-slider-rail]')!, { left: 0, width: 400 });
    const thumb = container.querySelector('[role="slider"]')!;
    fireEvent.pointerDown(thumb, { clientX: 40, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: x, clientY: 12, altKey: init.altKey });
    fireEvent.pointerUp(document, {});
    return onInput.mock.calls.at(-1)![0][0].value;
  }

  it('lands on a stop inside stopSnapPx, and passes it by with alt held', () => {
    // 106px is 26.5, 6px from the stop at 25.
    expect(dragTo(106)).toBe(25);
    expect(dragTo(106, { altKey: true })).toBe(26.5);
    expect(dragTo(106, { stopSnapPx: 4 })).toBe(26.5);
  });
});
