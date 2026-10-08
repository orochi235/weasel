import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { decimal } from '@weasel-js/quantity';
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
    .filter((el) => getComputedStyle(el).visibility !== 'hidden')
    .map((el) => el.dataset.tickAt!);
}

function endLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[data-range-end]')].map((el) => el.textContent ?? '');
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
