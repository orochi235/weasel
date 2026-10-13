import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { fraction, percent, qty, tag, type Quantity, type Tagged } from '@weasel-js/quantity';
import { Slider } from './Slider';
import type { Thumb } from './types';

const quarter = (): Thumb<Tagged> => ({ value: tag(0.25, percent()) });

describe('Slider with tagged thumbs', () => {
  it('keeps a tagged value tagged through an edit, and a bare one beside it bare', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <Slider<Thumb<Quantity>> min={0} max={1} step={0.25} thumbs={[quarter(), { value: 0.75 }]} onInput={() => {}} onChange={onChange} />,
    );
    fireEvent.keyDown(getAllByRole('slider')[0]!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith([{ value: { value: 0.5, display: { kind: 'percent' } } }, { value: 0.75 }]);
    fireEvent.keyDown(getAllByRole('slider')[1]!, { key: 'ArrowLeft' });
    expect(onChange.mock.calls.at(-1)![0][1]).toEqual({ value: 0.5 });
  });

  it('places a tagged thumb by its amount, and shows and speaks it through its own display over the slider\'s', () => {
    const { getAllByRole, container } = render(
      <Slider<Thumb<Quantity>> min={0} max={1} display={fraction()} readoutPlacement="inline-after" thumbs={[quarter(), { value: 0.5 }]} onInput={() => {}} />,
    );
    const [first, second] = getAllByRole('slider');
    expect(first).toHaveAttribute('aria-valuenow', '0.25');
    expect(first).toHaveAttribute('aria-valuetext', qty(0.25, percent()).spoken);
    expect(second).toHaveAttribute('aria-valuetext', qty(0.5, fraction()).spoken);
    expect(container.querySelector('[data-readout="inline"]')!.textContent).toBe(`${qty(0.25, percent()).text} / ${qty(0.5, fraction()).text}`);
  });

  it('hands keyStep and renderReadout the thumb as it was given', () => {
    const keyStep = vi.fn(() => 0.75);
    const renderReadout = vi.fn(() => 'r');
    const onChange = vi.fn();
    const { getByRole } = render(
      <Slider<Thumb<Tagged>> min={0} max={1} thumbs={[quarter()]} keyStep={keyStep} renderReadout={renderReadout}
        readoutPlacement="inline-after" onInput={() => {}} onChange={onChange} />,
    );
    expect(renderReadout).toHaveBeenLastCalledWith(quarter(), 0);
    fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' });
    expect(keyStep).toHaveBeenLastCalledWith(quarter(), 1, 0);
    expect(onChange).toHaveBeenLastCalledWith([{ value: { value: 0.75, display: { kind: 'percent' } } }]);
  });

  it('takes a tagged thumb from onAddThumb and hands it back tagged', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider<Thumb<Tagged>> min={0} max={1} thumbs={[quarter()]} onAddThumb={(at) => ({ value: tag(at, fraction()) })}
        onInput={() => {}} onChange={onChange} />,
    );
    const rail = container.querySelector<HTMLElement>('[data-slider-rail]')!;
    rail.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 10, width: 100, height: 10, toJSON: () => {} }) as DOMRect;
    fireEvent.pointerDown(rail.parentElement!, { clientX: 50, clientY: 5, button: 0 });
    const next = onChange.mock.calls.at(-1)![0] as Thumb<Tagged>[];
    expect(next[0]).toEqual(quarter());
    expect(next[1]!.value.display).toEqual({ kind: 'fraction' });
    expect(next[1]!.value.value).toBeCloseTo(0.5);
  });
});
