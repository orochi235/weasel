import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/faces.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BankFitter } from './bankFitter';
import { KeyboardLayouts } from './KeyboardLayout.stories';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Six copies of the story is the 1560 keys the workshop's Keyboard layouts
 *  page renders. */
const COPIES = 6;
/** Rendering, fitting, and the font load together took about 280 ms here,
 *  the fitting passes about 65 ms of it. The budgets leave a slower machine
 *  room while catching fitting that grows with layout work per key. */
const BUDGET_MS = 500;
const FIT_BUDGET_MS = 150;

it('fits a workshop page of banked keys within budget, forcing no layout per spelling', async () => {
  const rects = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  const styles = vi.spyOn(window, 'getComputedStyle');
  const flush = BankFitter.prototype.flush;
  let fitMs = 0;
  vi.spyOn(BankFitter.prototype, 'flush').mockImplementation(function (this: BankFitter) {
    const t = performance.now();
    flush.call(this);
    fitMs += performance.now() - t;
  });

  const start = performance.now();
  const { container } = render(
    <>
      {Array.from({ length: COPIES }, (_, i) => (
        <div key={i}>{KeyboardLayouts.render!({ legend: 'auto', font: 'oswald', wrap: true } as never, {} as never)}</div>
      ))}
    </>,
  );
  await wait(0);
  await document.fonts.ready;
  await wait(0);
  const elapsed = performance.now() - start;
  expect(document.fonts.check("300 13px 'Oswald'")).toBe(true);
  await wait(300);

  const keys = container.querySelectorAll('kbd').length;
  expect(keys).toBeGreaterThan(1500);
  expect(elapsed).toBeLessThan(BUDGET_MS);
  expect(fitMs).toBeLessThan(FIT_BUDGET_MS);
  expect(rects).not.toHaveBeenCalled();
  // One read when a key joins, and one when the web font arrives.
  expect(styles.mock.calls.length / keys).toBeLessThanOrEqual(2);
});
