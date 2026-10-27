import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Slider } from './Slider';
import { stubRect } from './testing/stubRect';

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

  it('keeps the marks out of the accessibility tree', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={[0, 50, 100]} thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    const marks = container.querySelector('[data-slider-ticks]') as HTMLElement;
    expect(marks.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Slider stop labels', () => {
  const labelsOf = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('[data-slider-stop-label]'));
  const STOPS = [{ value: 0, label: 'off' }, { value: 25, label: 'low' }, 50, { value: 100, label: 'max' }];

  it('labels the stops that carry one', () => {
    const { container } = render(<Slider min={0} max={100} stops={STOPS} thumbs={[{ value: 10 }]} onInput={() => {}} />);
    expect(labelsOf(container).map(l => l.textContent)).toEqual(['off', 'low', 'max']);
    expect(labelsOf(container).map(l => l.style.left)).toEqual(['0%', '25%', '100%']);
  });

  it('draws no label row for bare stops', () => {
    const { container } = render(<Slider min={0} max={100} stops={[0, 50, 100]} thumbs={[{ value: 10 }]} onInput={() => {}} />);
    expect(container.querySelector('[data-slider-stop-labels]')).toBeNull();
  });

  it('attracts a drag to a labeled stop like a bare one', () => {
    const onInput = vi.fn();
    const { container } = render(<Slider min={0} max={100} stops={STOPS} thumbs={[{ value: 10 }]} onInput={onInput} />);
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement as HTMLElement, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 20, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 48, clientY: 12 });
    expect(onInput.mock.calls.at(-1)![0][0].value).toBe(25);
  });

  it('labels only the ends when asked', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={STOPS} stopLabels="ends" thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    expect(labelsOf(container).map(l => l.textContent)).toEqual(['off', 'max']);
  });

  it('drops the label row when asked', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={STOPS} stopLabels="none" thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    expect(labelsOf(container)).toHaveLength(0);
  });

  it('keeps the labels when the marks are hidden', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={STOPS} showStops={false} thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    expect(labelsOf(container)).toHaveLength(3);
  });

  it('marks the labels a thumb rests on and the two ends', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={STOPS} thumbs={[{ value: 25 }, { value: 100 }]} onInput={() => {}} />,
    );
    expect(labelsOf(container).map(l => l.dataset.selected)).toEqual([undefined, 'true', 'true']);
    expect(labelsOf(container).map(l => l.dataset.edge)).toEqual(['left', undefined, 'right']);
  });

  // jsdom has no layout, so this asserts the proxy: inside the track, the row
  // shares its width rather than the track-plus-readout row's.
  it('hangs the labels off the track so an inline readout cannot shift them', () => {
    const { container } = render(
      <Slider min={0} max={100} stops={STOPS} readoutPlacement="inline-after" thumbs={[{ value: 10 }]} onInput={() => {}} />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    expect(track.querySelector('[data-slider-stop-labels]')).not.toBeNull();
  });

  it('keeps the labels out of the accessibility tree', () => {
    const { container } = render(<Slider min={0} max={100} stops={STOPS} thumbs={[{ value: 10 }]} onInput={() => {}} />);
    expect(container.querySelector('[data-slider-stop-labels]')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Slider even spacing', () => {
  const RATES = [0.25, 0.5, 1, 2, 4];
  const renderEven = (props: Partial<Parameters<typeof Slider>[0]> = {}) => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={10} stops={RATES} spacing="even" thumbs={[{ value: 1 }]} onInput={onInput} {...props} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement as HTMLElement, { left: 0, width: 200 });
    return { container, thumb, onInput };
  };
  const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0][0].value;

  it('spaces stops evenly however their values are distributed', () => {
    const { container } = renderEven();
    const ticks = Array.from(container.querySelectorAll<HTMLElement>('[data-slider-tick]'));
    expect(ticks.map(t => t.dataset.fraction)).toEqual(['0', '0.25', '0.5', '0.75', '1']);
  });

  it('places a value between two stops proportionally within their span', () => {
    const { thumb } = renderEven({ thumbs: [{ value: 1.5 }] });
    expect(thumb.style.left).toBe('62.5%');
  });

  it('runs the track from the first stop to the last', () => {
    const { thumb } = renderEven();
    expect(thumb.getAttribute('aria-valuemin')).toBe('0.25');
    expect(thumb.getAttribute('aria-valuemax')).toBe('4');
  });

  it('lets a drag rest between stops', () => {
    const { thumb, onInput } = renderEven();
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 125, clientY: 12 });
    expect(last(onInput)).toBeCloseTo(1.5, 5);
  });

  it('attracts a drag by track distance, not value distance', () => {
    const { thumb, onInput } = renderEven();
    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, button: 0 });
    // 144px is 6px short of the 2× stop, but 0.24 away from it in value — a
    // tolerance measured in value units would miss it.
    fireEvent.pointerMove(document, { clientX: 144, clientY: 12 });
    expect(last(onInput)).toBe(2);
  });

  it('moves every thumb the same track distance on a shift-drag', () => {
    const { container, onInput } = renderEven({ allowShiftAll: true, thumbs: [{ value: 0.5 }, { value: 2 }] });
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    fireEvent.pointerDown(thumbs[0], { clientX: 50, clientY: 12, button: 0, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 12 });
    const next = onInput.mock.calls.at(-1)![0];
    expect(next.map((t: { value: number }) => t.value)).toEqual([1, 4]);
  });

  it('falls back to linear spacing with fewer than two stops', () => {
    const { thumb } = renderEven({ stops: [5], thumbs: [{ value: 2.5 }] });
    expect(thumb.style.left).toBe('25%');
  });
});

describe('Slider strict snapping', () => {
  const renderStrict = (props: Partial<Parameters<typeof Slider>[0]> = {}) => {
    const onInput = vi.fn();
    const { container } = render(
      <Slider min={0} max={100} stops={[0, 25, 50, 75, 100]} snap="strict" thumbs={[{ value: 0 }]} onInput={onInput} {...props} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement as HTMLElement, { left: 0, width: 200 });
    return { container, thumb, onInput };
  };
  const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0][0].value;

  it('lands a drag on the nearest stop however far it is', () => {
    const { thumb, onInput } = renderStrict();
    fireEvent.pointerDown(thumb, { clientX: 0, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 70, clientY: 12 });
    expect(last(onInput)).toBe(25);
  });

  it('lands a track press on the nearest stop', () => {
    const { container, onInput } = renderStrict({ trackClick: 'move-nearest' });
    const track = container.querySelector('[data-slider-ticks]')!.parentElement as HTMLElement;
    fireEvent.pointerDown(track, { clientX: 130, clientY: 12, button: 0 });
    expect(last(onInput)).toBe(75);
  });

  it('ignores step between stops', () => {
    const { thumb, onInput } = renderStrict({ step: 1 });
    fireEvent.pointerDown(thumb, { clientX: 0, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 70, clientY: 12 });
    expect(last(onInput)).toBe(25);
  });

  it('is free movement when there are no stops', () => {
    const { thumb, onInput } = renderStrict({ stops: undefined });
    fireEvent.pointerDown(thumb, { clientX: 0, clientY: 12, button: 0 });
    fireEvent.pointerMove(document, { clientX: 70, clientY: 12 });
    expect(last(onInput)).toBe(35);
  });
});
