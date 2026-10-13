import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Slider, type TrackCtx } from './Slider';
import { stubRect } from './testing/stubRect';

// The rail is the track's value span: the track minus half a thumb at each
// end, so a thumb at min or max sits flush with the track's edge. jsdom has no
// layout, so these stub a 200px track whose rail runs 7..193 (a 14px thumb).
describe('Slider thumb fit', () => {
  const renderFit = (props: Partial<Parameters<typeof Slider>[0]> = {}) => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <Slider
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onInput={onInput}
        onChange={onChange}
        {...props}
      />,
    );
    const rail = container.querySelector<HTMLElement>('[data-slider-rail]');
    const track = rail?.parentElement ?? (container.querySelector('[role="slider"]')!.parentElement as HTMLElement);
    stubRect(track, { left: 0, width: 200, right: 200 });
    if (rail) stubRect(rail, { left: 7, width: 186, right: 193 });
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    return { container, rail, track, thumb, onInput, onChange };
  };

  const lastValue = (fn: ReturnType<typeof vi.fn>): number => fn.mock.calls[fn.mock.calls.length - 1][0][0].value;

  it('lays thumbs, ticks and stop labels out on a rail inside the track', () => {
    const { rail, thumb } = renderFit({ stops: [{ value: 0, label: 'lo' }, { value: 1, label: 'hi' }] });
    expect(rail).not.toBeNull();
    expect(thumb.parentElement).toBe(rail);
    expect(rail!.querySelector('[data-slider-ticks]')).not.toBeNull();
    expect(rail!.querySelector('[data-slider-stop-labels]')).not.toBeNull();
  });

  it('maps a drag from the rail: its ends are min and max, its middle the midpoint', () => {
    const { thumb, onInput } = renderFit();
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 7, clientY: 12, pointerId: 1 });
    expect(lastValue(onInput)).toBeCloseTo(0, 5);
    fireEvent.pointerMove(document, { clientX: 100, clientY: 12, pointerId: 1 });
    expect(lastValue(onInput)).toBeCloseTo(0.5, 5);
    fireEvent.pointerMove(document, { clientX: 193, clientY: 12, pointerId: 1 });
    expect(lastValue(onInput)).toBeCloseTo(1, 5);
    fireEvent.pointerUp(document, { clientX: 193, clientY: 12, pointerId: 1 });
  });

  it('clamps a drag into the padded ends of the track to min and max', () => {
    const { thumb, onInput } = renderFit();
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 2, clientY: 12, pointerId: 1 });
    expect(lastValue(onInput)).toBe(0);
    fireEvent.pointerMove(document, { clientX: 198, clientY: 12, pointerId: 1 });
    expect(lastValue(onInput)).toBe(1);
    fireEvent.pointerUp(document, { clientX: 198, clientY: 12, pointerId: 1 });
  });

  it('maps a track press from the rail', () => {
    const { track, onInput } = renderFit({ trackClick: 'move-nearest' });
    fireEvent.pointerDown(track, { clientX: 53.5, clientY: 12, pointerId: 1, button: 0 });
    expect(lastValue(onInput)).toBeCloseTo(0.25, 5);
    fireEvent.pointerUp(document, { clientX: 53.5, clientY: 12, pointerId: 1 });
  });

  it("insets the rail by default, and thumbFit='overhang' asks for a full-width one", () => {
    const inside = renderFit();
    expect(inside.container.firstElementChild!.className).not.toMatch(/overhang/);
    const over = renderFit({ thumbFit: 'overhang' });
    expect(over.container.firstElementChild!.className).toMatch(/overhang/);
  });

  it('gives renderTrack the rail as a CSS position, so a painted ramp lines up with the thumbs', () => {
    let ctx: TrackCtx | undefined;
    renderFit({ renderTrack: (c) => { ctx = c; return null; } });
    expect(ctx!.fractionToPosition(0)).toBe('calc(var(--rp-thumb-inset) + 0 * (100% - 2 * var(--rp-thumb-inset)))');
    expect(ctx!.fractionToPosition(0.3)).toBe('calc(var(--rp-thumb-inset) + 0.3 * (100% - 2 * var(--rp-thumb-inset)))');
  });
});
