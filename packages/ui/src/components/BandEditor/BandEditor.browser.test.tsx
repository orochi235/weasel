import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { decimal, fraction } from '@weasel-js/quantity';
import { BandEditor } from './BandEditor';

afterEach(cleanup);

const BANDS = [{ from: 0, data: 'a' }, { from: 40, data: 'b' }];
const TICKS = [1, 50, 99].map((at) => ({ at }));

function editor(props: { min?: number; rescalable?: boolean }) {
  return (
    <div style={{ width: 300 }}>
      <BandEditor
        value={BANDS}
        min={props.min ?? 0}
        max={100}
        scale="linear"
        ticks={TICKS}
        display={decimal({ places: 0 })}
        onChange={() => {}}
        onRangeChange={props.rescalable === false ? undefined : () => {}}
      />
    </div>
  );
}

function shownTicks(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[data-tick-at]')]
    .filter((el) => getComputedStyle(el.firstElementChild!).visibility !== 'hidden')
    .map((el) => el.dataset.tickAt!);
}

/** Every label a reader can see, ends included, left to right. */
function shownLabels(container: HTMLElement): DOMRect[] {
  return [...container.querySelectorAll<HTMLElement>('[data-tick-at] > *, [data-range-end] > *')]
    .filter((el) => getComputedStyle(el).visibility !== 'hidden')
    .map((el) => el.getBoundingClientRect())
    .sort((a, b) => a.left - b.left);
}

/** An end's label as a copy reads it: a stacked fraction's MathML digits are not part of that. */
function endLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[data-range-end]')].map((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    for (const math of copy.querySelectorAll('math')) math.remove();
    return copy.textContent ?? '';
  });
}

describe('BandEditor range-end ticks', () => {
  test('labels both ends and hides the ticks whose labels would collide with them', () => {
    const { container } = render(editor({}));
    expect(endLabels(container)).toEqual(['0', '100']);
    expect(shownTicks(container)).toEqual(['50']);
  });

  test('keeps the end labels inside the track', () => {
    const { container } = render(editor({}));
    const track = container.querySelector('[data-band-ruler]')!.getBoundingClientRect();
    const ends = container.querySelectorAll('[data-range-end] > *');
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      const box = end.getBoundingClientRect();
      expect(box.left).toBeGreaterThanOrEqual(track.left);
      expect(box.right).toBeLessThanOrEqual(track.right);
    }
  });

  test('re-checks when an end moves onto a tick that was clear', () => {
    const { container, rerender } = render(editor({}));
    rerender(editor({ min: 48 }));
    expect(endLabels(container)).toEqual(['48', '100']);
    expect(shownTicks(container)).toEqual([]);
  });

  test('draws no end ticks, and hides nothing, when the range is fixed', () => {
    const { container } = render(editor({ rescalable: false }));
    expect(endLabels(container)).toEqual([]);
    expect(shownTicks(container)).toEqual(['1', '50', '99']);
  });
});

describe('BandEditor tick labels', () => {
  const FRACTIONS = [1 / 45, 1 / 30, 1 / 24, 1 / 18, 1 / 12, 1 / 6, 1 / 3].map((at) => ({ at }));

  function crowded(width: number, scale: 'linear' | 'log') {
    return (
      <div style={{ width }}>
        <BandEditor
          value={[{ from: 1 / 64, data: 'a' }]}
          min={1 / 64}
          max={1 / 2}
          scale={scale}
          ticks={FRACTIONS}
          display={fraction()}
          onChange={() => {}}
          onRangeChange={() => {}}
        />
      </div>
    );
  }

  for (const [width, scale] of [[260, 'log'], [260, 'linear'], [600, 'linear']] as const) {
    test(`keeps every shown label clear of its neighbors at ${width}px on a ${scale} scale`, () => {
      const { container } = render(crowded(width, scale));
      const labels = shownLabels(container);
      for (let i = 1; i < labels.length; i++) expect(labels[i]!.left - labels[i - 1]!.right).toBeGreaterThanOrEqual(4);
      expect(endLabels(container)).toEqual(['1/64', '1/2']);
      for (const end of container.querySelectorAll('[data-range-end] > *')) {
        expect(getComputedStyle(end).visibility).not.toBe('hidden');
      }
    });
  }

  test('keeps drawing the notch of a tick whose label gives way', () => {
    const { container } = render(crowded(260, 'linear'));
    const ticks = [...container.querySelectorAll<HTMLElement>('[data-tick-at]')];
    expect(shownTicks(container).length).toBeLessThan(ticks.length);
    for (const tick of ticks) expect(getComputedStyle(tick).visibility).not.toBe('hidden');
  });

  test('keeps the rounder of two colliding fractions', () => {
    const { container } = render(crowded(260, 'linear'));
    const shown = shownTicks(container).map(Number);
    expect(shown).toContain(1 / 3);
    expect(shown).toContain(1 / 6);
  });

  test('draws a fraction stacked, inside the ruler', () => {
    const { container } = render(crowded(600, 'log'));
    const label = container.querySelector<HTMLElement>(`[data-tick-at="${1 / 45}"] > *`)!;
    expect(label.querySelector('mfrac')).not.toBeNull();
    const ruler = container.querySelector('[data-band-ruler]')!.getBoundingClientRect();
    expect(label.getBoundingClientRect().top).toBeGreaterThanOrEqual(ruler.top);
  });
});

describe('BandEditor band captions', () => {
  test('clips a caption along the track only, so its descenders are drawn', () => {
    const { container } = render(
      <div style={{ width: 300 }}>
        <BandEditor value={BANDS} min={0} max={100} scale="linear" onChange={() => {}} renderBand={() => 'gypsy'} />
      </div>,
    );
    const band = container.querySelector<HTMLElement>('[data-band-index]')!;
    const caption = band.firstElementChild as HTMLElement;
    const text = document.createRange();
    text.selectNodeContents(caption);
    // The text's own box is taller than a line of leading 1; the caption must not cut it to that line.
    expect(text.getBoundingClientRect().bottom).toBeGreaterThan(caption.getBoundingClientRect().bottom);
    expect(getComputedStyle(caption).overflowY).toBe('visible');
    expect(text.getBoundingClientRect().bottom).toBeLessThanOrEqual(band.getBoundingClientRect().bottom);
  });
});

test('a fraction label centers its digits on its tick, three pixels clear of the notch', () => {
  const { container } = render(
    <div style={{ width: 600 }}>
      <BandEditor
        value={[{ from: 1 / 64, data: 'a' }, { from: 1 / 8, data: 'b' }]}
        min={1 / 64}
        max={1 / 2}
        scale="linear"
        ticks={[1 / 6, 1 / 3].map((at) => ({ at }))}
        display={fraction()}
        onChange={() => {}}
      />
    </div>,
  );
  const ticks = [...container.querySelectorAll<HTMLElement>('[data-tick-at]')];
  expect(ticks.length).toBeGreaterThan(0);
  for (const tick of ticks) {
    const notch = tick.getBoundingClientRect();
    const denominator = tick.querySelector('mfrac > :last-child')!;
    const range = document.createRange();
    range.selectNodeContents(denominator);
    const digits = range.getBoundingClientRect();
    expect(Math.abs(digits.left + digits.width / 2 - (notch.left + notch.width / 2))).toBeLessThan(0.5);
    expect(notch.top - tick.firstElementChild!.getBoundingClientRect().bottom).toBeCloseTo(3, 0);
  }
});
