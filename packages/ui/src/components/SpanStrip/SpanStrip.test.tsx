import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpanStrip } from './SpanStrip';
import { SpanStrips, rulerTicks } from './SpanStrips';
import { atFraction, msAtFraction, placeSpans, spanAt, spokenAt, stripWindow, type SpanStripSpan } from './spanLayout';

const SPANS: SpanStripSpan[] = [
  { id: 'a', label: 'review', ms: 300, state: 'done', color: 'red' },
  { id: 'b', label: 'fix', ms: 600, state: 'active' },
  { id: 'c', label: 'patch', ms: 100 },
];

describe('spanLayout', () => {
  it('splits a strip into a stripe per track, each track chaining its own spans', () => {
    const placed = placeSpans([
      { id: 'a', label: 'a', ms: 30 }, { id: 'b', label: 'b', ms: 50, track: 1 },
      { id: 'c', label: 'c', ms: 20 }, { id: 'd', label: 'd', ms: 10, track: 1 },
    ], { from: 0, to: 100 });
    expect(placed.map((p) => [p.span.id, p.start, p.end, p.track, p.tracks])).toEqual([
      ['a', 0, 30, 0, 2], ['b', 0, 50, 1, 2], ['c', 30, 50, 0, 2], ['d', 50, 60, 1, 2],
    ]);
    expect(placeSpans([{ id: 'a', label: 'a', ms: 1 }], { from: 0, to: 1 })[0]!.tracks).toBe(1);
  });

  it('places a span covering several tracks after the latest end on any of them', () => {
    const placed = placeSpans([
      { id: 'a', label: 'a', ms: 30 }, { id: 'b', label: 'b', ms: 50, track: 1 }, { id: 'both', label: 'both', ms: 10, trackSpan: 2 },
    ], { from: 0, to: 100 });
    expect(placed.map((p) => [p.span.id, p.start, p.track, p.trackSpan, p.tracks])).toEqual([
      ['a', 0, 0, 1, 2], ['b', 0, 1, 1, 2], ['both', 50, 0, 2, 2],
    ]);
  });

  const WIN = stripWindow(SPANS);

  it('lays spans with no start end to end, the window running to where the last ends', () => {
    expect(WIN).toEqual({ from: 0, to: 1000 });
    expect(placeSpans(SPANS, WIN).map((p) => [p.from, p.share])).toEqual([[0, 0.3], [0.3, 0.6], [0.9, 0.1]]);
  });

  it('places a span with a start where it starts, the ones after it following on', () => {
    const win = { from: 1000, to: 3000 };
    const placed = placeSpans([{ id: 'a', label: 'a', ms: 200, start: 1400 }, { id: 'b', label: 'b', ms: 400 }, { id: 'c', label: 'c', ms: 100, start: 2600 }], win);
    expect(placed.map((p) => [p.start, p.end])).toEqual([[1400, 1600], [1600, 2000], [2600, 2700]]);
    expect(placed[0]!.from).toBeCloseTo(0.2);
    expect(placed[1]!.share).toBeCloseTo(0.2);
  });

  it('places the playhead along the window, held inside it', () => {
    expect(atFraction(WIN, 450)).toBeCloseTo(0.45);
    expect(atFraction(WIN, -10)).toBe(0);
    expect(atFraction(WIN, 5000)).toBe(1);
    expect(msAtFraction(WIN, 0.5)).toBe(500);
  });

  it('finds the span holding a moment, or the last to start before it in a gap', () => {
    const placed = placeSpans(SPANS, WIN);
    expect(spanAt(placed, 0)?.id).toBe('a');
    expect(spanAt(placed, 300)?.id).toBe('b');
    expect(spanAt(placed, 950)?.id).toBe('c');
    expect(spokenAt(placed, WIN, 450)).toBe('fix, 45% through');
    const gappy = placeSpans([{ id: 'a', label: 'a', ms: 10, start: 0 }, { id: 'b', label: 'b', ms: 10, start: 50 }], { from: 0, to: 100 });
    expect(spanAt(gappy, 30)?.id).toBe('a');
  });

  it('follows the latest end on a track, not the last span placed on it', () => {
    const placed = placeSpans([
      { id: 'a', label: 'a', ms: 10 }, { id: 'b', label: 'b', ms: 3, start: 2 }, { id: 'c', label: 'c', ms: 4 },
    ], { from: 0, to: 20 });
    expect(placed.map((p) => [p.start, p.end])).toEqual([[0, 10], [2, 5], [10, 14]]);
  });
});

describe('SpanStrip', () => {
  it('is a meter without onSeek, with its value spoken', () => {
    render(<SpanStrip spans={SPANS} at={450} aria-label="lane" valueText="fixing, 2 minutes in" />);
    const meter = screen.getByRole('meter', { name: 'lane' });
    expect(meter).toHaveAttribute('aria-valuenow', '450');
    expect(meter).toHaveAttribute('aria-valuemax', '1000');
    expect(meter).toHaveAttribute('aria-valuetext', 'fixing, 2 minutes in');
    expect(meter).not.toHaveAttribute('tabindex');
  });

  it("sets its playhead and each segment's place as custom properties, never through a style prop", () => {
    const { container } = render(<SpanStrip spans={SPANS} at={450} aria-label="lane" />);
    expect(screen.getByRole('meter').style.getPropertyValue('--at')).toBe('0.45000');
    const fix = container.querySelectorAll<HTMLElement>('[data-state="active"]')[0]!;
    expect([fix.style.getPropertyValue('--span-from'), fix.style.getPropertyValue('--span-share')]).toEqual(['0.30000', '0.60000']);
  });

  it('draws on a window it is given, its value in that time', () => {
    render(<SpanStrip spans={[{ id: 'a', label: 'a', ms: 100, start: 1200 }]} window={{ from: 1000, to: 2000 }} at={1500} aria-label="lane" />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuemin', '1000');
    expect(meter).toHaveAttribute('aria-valuenow', '1500');
    expect(meter.style.getPropertyValue('--at')).toBe('0.50000');
  });

  it('labels each span, and colors the played copy from each span', () => {
    const { container } = render(<SpanStrip spans={SPANS} at={450} aria-label="lane" />);
    expect(screen.getAllByText('review')).toHaveLength(2);
    const played = [...container.querySelectorAll<HTMLElement>('[aria-hidden] > [data-state]')];
    expect(played.map((el) => el.dataset.state)).toEqual(['done', 'active', 'pending']);
    expect(played[0]!.style.getPropertyValue('--span-color')).toBe('red');
    expect(played[1]!.style.getPropertyValue('--span-color')).toBe('');
  });

  it('is a slider with onSeek: arrows step, Home and End go to the ends', () => {
    const onSeek = vi.fn();
    render(<SpanStrip spans={SPANS} at={450} aria-label="lane" onSeek={onSeek} />);
    const slider = screen.getByRole('slider', { name: 'lane' });
    expect(slider).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenLastCalledWith(460, false);
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true });
    expect(onSeek).toHaveBeenLastCalledWith(350, false);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onSeek).toHaveBeenLastCalledWith(1000, false);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onSeek).toHaveBeenLastCalledWith(0, false);
  });

  it('steps an arrow from the end it shows when the moment lies outside the window', () => {
    const onSeek = vi.fn();
    const { rerender } = render(<SpanStrip spans={SPANS} window={{ from: 0, to: 1000 }} at={1500} aria-label="lane" onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'lane' }), { key: 'ArrowLeft' });
    expect(onSeek).toHaveBeenLastCalledWith(990, false);
    rerender(<SpanStrip spans={SPANS} window={{ from: 0, to: 1000 }} at={-500} aria-label="lane" onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'lane' }), { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenLastCalledWith(10, false);
  });

  it('holds while pressed, lets go on release, and goes back where it began on a lost pointer', () => {
    const onSeek = vi.fn();
    render(<SpanStrip spans={SPANS} at={450} aria-label="lane" onSeek={onSeek} />);
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 22, right: 200, bottom: 22, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(500, true);
    fireEvent.pointerMove(slider, { clientX: 150, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(750, true);
    fireEvent.pointerUp(slider, { clientX: 160, pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(800, false);
    fireEvent.pointerDown(slider, { clientX: 20, pointerId: 2 });
    fireEvent.pointerCancel(slider, { pointerId: 2 });
    expect(onSeek).toHaveBeenLastCalledWith(450, false);
  });

  it('ignores a second pointer while one holds', () => {
    const onSeek = vi.fn();
    const { rerender } = render(<SpanStrip spans={SPANS} at={450} aria-label="lane" onSeek={onSeek} />);
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 22, right: 200, bottom: 22, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(slider, { clientX: 20, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 60, pointerId: 1 });
    rerender(<SpanStrip spans={SPANS} at={300} aria-label="lane" onSeek={onSeek} />);
    const calls = onSeek.mock.calls.length;
    fireEvent.pointerDown(slider, { clientX: 180, pointerId: 2 });
    fireEvent.pointerMove(slider, { clientX: 190, pointerId: 2 });
    fireEvent.pointerUp(slider, { clientX: 190, pointerId: 2 });
    expect(onSeek).toHaveBeenCalledTimes(calls);
    fireEvent.pointerCancel(slider, { pointerId: 1 });
    expect(onSeek).toHaveBeenLastCalledWith(450, false);
  });

  it('seeks only on a primary-button press', () => {
    const onSeek = vi.fn();
    render(<SpanStrip spans={SPANS} at={450} aria-label="lane" onSeek={onSeek} />);
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 22, right: 200, bottom: 22, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1, button: 2 });
    fireEvent.pointerMove(slider, { clientX: 150, pointerId: 1 });
    fireEvent.pointerUp(slider, { clientX: 150, pointerId: 1, button: 2 });
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 2, button: 1 });
    expect(onSeek).not.toHaveBeenCalled();
  });
});

describe('SpanStrips', () => {
  it('stacks a strip per row on one clock, each with its lead, and one playhead for all', () => {
    const { container } = render(
      <SpanStrips aria-label="lanes" window={{ from: 0, to: 2000 }} at={700} ruler={{ steps: [100, 500], format: (ms) => `${ms}` }} rows={[
        { id: 'a', spans: SPANS, 'aria-label': 'core.ops', lead: <b>core.ops</b> },
        { id: 'b', spans: [{ id: 'x', label: 'late', ms: 300, start: 900 }], 'aria-label': 'geom', valueText: 'geom, waiting' },
      ]} />,
    );
    const rows = within(screen.getByRole('list', { name: 'lanes' })).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole('meter', { name: 'core.ops' })).toHaveAttribute('aria-valuemax', '2000');
    expect(within(rows[0]!).getByText('core.ops', { selector: 'b' })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('meter')).toHaveAttribute('aria-valuetext', 'geom, waiting');
    const stack = container.firstElementChild as HTMLElement;
    expect([stack.style.getPropertyValue('--rows'), stack.style.getPropertyValue('--at')]).toEqual(['2', '0.35000']);
  });
});

describe('SpanStrips without a playhead', () => {
  it('draws no line, plays every strip to its end, and fills each span as far as it says', () => {
    const { container } = render(
      <SpanStrips window={{ from: 0, to: 3 }} rows={[{ id: 'a', 'aria-label': 'core.ops', spans: [
        { id: 'x', label: 'x', ms: 1, fill: 1 }, { id: 'y', label: 'y', ms: 1, fill: 0.4 }, { id: 'z', label: 'z', ms: 1, fill: 0 },
      ] }]} />,
    );
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '3');
    const played = [...container.querySelectorAll<HTMLElement>('[aria-hidden] > [data-state]')];
    expect(played.map((el) => el.style.getPropertyValue('--span-fill'))).toEqual(['1.0000', '0.4000', '0.0000']);
    expect(container.querySelectorAll('[role=list] > [aria-hidden]')).toHaveLength(0);
  });
});

describe('rulerTicks', () => {
  it('takes the first step that keeps ticks far enough apart, on whole steps from the origin', () => {
    const ruler = { steps: [5, 10, 30], origin: 2, format: (ms: number) => `t${ms}` };
    expect(rulerTicks({ from: 0, to: 100 }, 640, ruler).map((t) => t.at)).toEqual([2, 12, 22, 32, 42, 52, 62, 72, 82, 92]);
    expect(rulerTicks({ from: 0, to: 100 }, 200, ruler).map((t) => t.at)).toEqual([2, 62]);
    expect(rulerTicks({ from: 0, to: 100 }, 400, ruler).map((t) => t.at)).toEqual([2, 32, 62, 92]);
    expect(rulerTicks({ from: 0, to: 100 }, 200, ruler)[0]!.label).toBe('t2');
    expect(rulerTicks({ from: 0, to: 100 }, 0, ruler)).toEqual([]);
  });

  it('thins the last step to a whole multiple when no step spaces the ticks far enough apart', () => {
    const ticks = rulerTicks({ from: 0, to: 86_400_000 }, 800, { steps: [1000], format: String });
    expect(ticks).toHaveLength(13);
    expect(ticks[1]!.at - ticks[0]!.at).toBe(6_912_000);
  });

  it('lands on the window\'s end under a fractional step', () => {
    expect(rulerTicks({ from: 0, to: 0.7 }, 640, { steps: [0.1], format: String }).at(-1)!.at).toBeCloseTo(0.7, 12);
    expect(rulerTicks({ from: 0, to: 0.7 }, 640, { steps: [0.1], format: String })).toHaveLength(8);
  });

  it('throws on a step that is not positive', () => {
    for (const st of [0, -5, Number.NaN]) {
      expect(() => rulerTicks({ from: 0, to: 100 }, 640, { steps: [st], format: String })).toThrow(RangeError);
    }
  });
});
