import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { lineShape, trackRun } from '@weasel-js/geom';
import { RunBand, RunEnds, shownOf, useRunRow, type RunOverflow } from './useRunRow';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const shape = lineShape({ x: 0, y: 0 }, { x: 100, y: 0 });
const run = trackRun(shape);
const keyOf = (el: Element): string | null => el.getAttribute('data-chip');

/** A row that is not a bar: chips 20 long, 10 apart, keyed by an attribute of its own. */
function Chips({ count, overflow, length = 20 }: { count: number; overflow?: RunOverflow; length?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const row = useRunRow({ root, keyOf, run, lengths: Array.from({ length: count }, () => length), gap: 10, align: 'start', overflow });
  return (
    <div ref={root} data-testid="row" {...row.rootProps}>
      <RunBand row={row} shape={shape} />
      {Array.from({ length: count }, (_, i) => {
        const at = row.place(i);
        return <button key={i} data-chip={`c${i}`} className={at.className} style={at.style} data-clipped={at.clipped}>{i}</button>;
      })}
      <RunEnds row={row} run={run} />
    </div>
  );
}

const xs = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-chip]')].map((el) => el.style.getPropertyValue('--at-x'));

describe('useRunRow', () => {
  test('lays any keyed children along the run, gap apart', () => {
    const { getByTestId } = render(<Chips count={3} />);
    expect(xs(getByTestId('row'))).toEqual(['10px', '40px', '70px']);
    expect(getByTestId('row')).not.toHaveAttribute('data-scrolls');
  });

  test('a row too long for its run scrolls it on the wheel, and marks the end it runs past', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { getByTestId } = render(<Chips count={5} />);
    const root = getByTestId('row');
    expect(root).toHaveAttribute('data-scrolls');
    expect(root.querySelector('[data-more-past="end"]')).not.toBeNull();
    expect(root.querySelector('[data-more-past="start"]')).toBeNull();
    act(() => {
      root.dispatchEvent(new WheelEvent('wheel', { deltaY: 1000, bubbles: true, cancelable: true }));
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 140 of chips on a run 100 long scroll at most 40; the first, wholly past the start, waits there.
    expect(xs(root)).toEqual(['0px', '0px', '30px', '60px', '90px']);
    expect(root.querySelector('[data-more-past="start"]')).not.toBeNull();
    expect(root.querySelector('[data-more-past="end"]')).toBeNull();
  });

  test('a row over its run by no more than RUN_SLACK is drawn whole, centered, and does not scroll', () => {
    const { getByTestId } = render(<Chips count={3} length={28} />);
    const root = getByTestId('row');
    expect(root).not.toHaveAttribute('data-scrolls');
    expect(root.querySelector('[data-more-past]')).toBeNull();
    // 104 of chips on a run 100 long: laid back by half the 4 over, none faded or clipped.
    expect(xs(root)).toEqual(['12px', '50px', '88px']);
    for (const chip of root.querySelectorAll<HTMLElement>('[data-chip]')) {
      expect(chip.style.getPropertyValue('--along-shown')).toBe('');
      expect(chip).not.toHaveAttribute('data-clipped');
    }
  });

  test("with overflow 'center' a row too long sits centered and does not scroll", () => {
    const { getByTestId } = render(<Chips count={5} overflow="center" />);
    const root = getByTestId('row');
    expect(root).not.toHaveAttribute('data-scrolls');
    expect(root.querySelector('[data-more-past]')).toBeNull();
    // Laid back by half the 40 over: the two ends, wholly off, wait at the run's ends.
    expect(xs(root)).toEqual(['0px', '20px', '50px', '80px', '100px']);
  });
});

describe('shownOf', () => {
  test('is the share of an item lying on the run', () => {
    expect(shownOf(50, 20, 100)).toBe(1);
    expect(shownOf(-5, 20, 100)).toBe(0.25);
    expect(shownOf(105, 20, 100)).toBe(0.25);
    expect(shownOf(-20, 20, 100)).toBe(0);
  });
  test('an item of no length is wholly on or wholly off', () => {
    expect(shownOf(0, 0, 100)).toBe(1);
    expect(shownOf(-1, 0, 100)).toBe(0);
  });
});
