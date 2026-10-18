import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/faces.css';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BankFitter } from './bankFitter';
import { KeyboardLayouts } from './KeyboardLayout.stories';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Six copies of the story is the 1560 keys the workshop's Keyboard layouts
 *  page renders. */
const COPIES = 6;
/** A bank's passes: one as its keys join, one when the web font arrives, and
 *  room for a resize. A pass lays the page out once however many keys it reads. */
const PASSES_PER_BANK = 4;

// Counted, not timed: a millisecond budget failed whenever another job shared the node, and the
// cost it stood for, layout work growing with the keys, is the passes and reads counted here.
it('fits a workshop page of banked keys in a few passes, forcing no layout per spelling', async () => {
  const rects = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  const styles = vi.spyOn(window, 'getComputedStyle');
  const flush = BankFitter.prototype.flush;
  const passes = new Map<BankFitter, number>();
  vi.spyOn(BankFitter.prototype, 'flush').mockImplementation(function (this: BankFitter) {
    const read = styles.mock.calls.length;
    flush.call(this);
    if (styles.mock.calls.length > read) passes.set(this, (passes.get(this) ?? 0) + 1);
  });

  const { container } = renderWithIcons(
    <>
      {Array.from({ length: COPIES }, (_, i) => (
        <div key={i}>{KeyboardLayouts.render!({ legend: 'auto', font: 'oswald', wrap: true } as never, {} as never)}</div>
      ))}
    </>,
  );
  await wait(0);
  await document.fonts.ready;
  await wait(0);
  expect(document.fonts.check("300 13px 'Oswald'")).toBe(true);
  await wait(300);

  const keys = container.querySelectorAll('kbd').length;
  expect(keys).toBeGreaterThan(1500);
  expect(passes.size).toBeGreaterThan(0);
  expect(Math.max(...passes.values())).toBeLessThanOrEqual(PASSES_PER_BANK);
  expect(rects).not.toHaveBeenCalled();
  // One read when a key joins, and one when the web font arrives.
  expect(styles.mock.calls.length / keys).toBeLessThanOrEqual(2);
});
