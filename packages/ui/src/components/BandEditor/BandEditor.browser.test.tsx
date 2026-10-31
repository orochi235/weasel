import '@weasel-js/theme/tokens.css';
import { cleanup, fireEvent, render } from '@testing-library/react';
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

  test('runs every tick, ends included, down to the band strip, with its label where it was', () => {
    const { container } = render(editor({}));
    const ruler = container.querySelector('[data-band-ruler]')!.getBoundingClientRect();
    const strip = container.querySelector('[data-band-index]')!.getBoundingClientRect();
    const ticks = [...container.querySelectorAll<HTMLElement>('[data-tick-at], [data-range-end]')];
    expect(ticks.length).toBe(TICKS.length + 2);
    for (const tick of ticks) {
      expect(tick.getBoundingClientRect().bottom).toBeCloseTo(strip.top, 1);
      expect(ruler.bottom - tick.firstElementChild!.getBoundingClientRect().bottom).toBeCloseTo(9, 1);
    }
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

test('a fraction label sits three pixels clear of its notch', () => {
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
    expect(tick.getBoundingClientRect().top - tick.firstElementChild!.getBoundingClientRect().bottom).toBeCloseTo(3, 0);
  }
});

describe('BandEditor mid-drag', () => {
  const THREE = [{ from: 0, data: 'a' }, { from: 40, data: 'b' }, { from: 70, data: 'c' }];

  function dragging(start: 'seam' | 'band') {
    const view = render(
      <div style={{ width: 300 }}>
        <BandEditor value={THREE} min={0} max={100} scale="linear" onChange={() => {}} />
      </div>,
    );
    const target = view.container.querySelector<HTMLElement>(start === 'seam' ? '[aria-label="Seam 1"]' : '[data-band-index="1"]')!;
    const box = target.getBoundingClientRect();
    const y = box.top + box.height / 2;
    fireEvent.pointerDown(target, { clientX: box.left + box.width / 2, clientY: y, button: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: box.left + box.width / 2 + 20, clientY: y, pointerId: 1 });
    return { ...view, y };
  }

  function hitAt(band: Element, y: number): Element {
    const box = band.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, y)!;
  }

  // The pointer runs ahead of a dragged seam whenever the seam lags a frame, clamps, or snaps; a band it lands
  // on took its hover fill for that frame, which read as the bands flickering.
  test('no band answers the pointer while a seam is dragged, and every band does again after', () => {
    const { container, y } = dragging('seam');
    const bands = [...container.querySelectorAll('[data-band-index]')];
    for (const band of bands) {
      const hit = hitAt(band, y);
      expect(hit.closest('[data-band-index]')).toBeNull();
      expect(getComputedStyle(hit).cursor).toBe('ew-resize');
    }
    fireEvent.pointerUp(document, { pointerId: 1 });
    for (const band of bands) expect(hitAt(band, y).closest('[data-band-index]')).toBe(band);
  });

  test('a dragged band body keeps the grabbing cursor wherever the pointer goes', () => {
    const { container, y } = dragging('band');
    const hit = hitAt(container.querySelector('[data-band-index="2"]')!, y);
    expect(hit.closest('[data-band-index]')).toBeNull();
    expect(getComputedStyle(hit).cursor).toBe('grabbing');
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});
