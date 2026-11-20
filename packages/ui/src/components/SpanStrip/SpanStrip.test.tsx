import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpanStrip } from './SpanStrip';
import { atFraction, msAtFraction, spanAt, spansTemplate, spokenAt, type SpanStripSpan } from './spanLayout';

const SPANS: SpanStripSpan[] = [
  { id: 'a', label: 'review', ms: 300, state: 'done', color: 'red' },
  { id: 'b', label: 'fix', ms: 600, state: 'active' },
  { id: 'c', label: 'patch', ms: 100 },
];

describe('spanLayout', () => {
  it('gives each span its share of the whole as a column', () => {
    expect(spansTemplate(SPANS)).toBe('0.30000fr 0.60000fr 0.10000fr');
  });

  it('splits an empty strip evenly', () => {
    expect(spansTemplate([{ id: 'a', label: 'a', ms: 0 }, { id: 'b', label: 'b', ms: -4 }])).toBe('1fr 1fr');
  });

  it('places the playhead along the strip, held inside it', () => {
    expect(atFraction(SPANS, 450)).toBeCloseTo(0.45);
    expect(atFraction(SPANS, -10)).toBe(0);
    expect(atFraction(SPANS, 5000)).toBe(1);
    expect(msAtFraction(SPANS, 0.5)).toBe(500);
  });

  it('finds the span holding a moment', () => {
    expect(spanAt(SPANS, 0)?.id).toBe('a');
    expect(spanAt(SPANS, 300)?.id).toBe('b');
    expect(spanAt(SPANS, 950)?.id).toBe('c');
    expect(spokenAt(SPANS, 450)).toBe('fix, 45% through');
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

  it('sets its columns and playhead as custom properties, never through a style prop it was given', () => {
    render(<SpanStrip spans={SPANS} at={450} aria-label="lane" />);
    const meter = screen.getByRole('meter');
    expect(meter.style.getPropertyValue('--spans')).toBe('0.30000fr 0.60000fr 0.10000fr');
    expect(meter.style.getPropertyValue('--at')).toBe('0.45000');
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
});
