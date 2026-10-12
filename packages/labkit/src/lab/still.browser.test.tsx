import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './presentation.browser.test.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { TrialClock } from '../clock/trialClock';
import type { Instrument } from '../instrument/types';
import { Lab, type LabProps } from './Lab';

// That a still says it is ready only after its frame is drawn is the frame
// loop's and the canvas's to answer, and jsdom's `postMessage` delivers an
// event with no `source`, which a browser's never is.

let drawn: number[] = [];
let clock: TrialClock | null = null;

afterEach(() => {
  cleanup();
  drawn = [];
  clock = null;
});

const Timed: Instrument = {
  name: 'Timed',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  clock: { duration: 4000, rate: 1 },
  canvas: {
    layers: [
      {
        id: 'fill',
        timed: true,
        draw: (ctx, { elapsed }) => {
          drawn.push(elapsed);
          ctx.fillStyle = 'rgb(0, 128, 255)';
          ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
        },
      },
    ],
  },
  render: (ctx) => {
    clock = ctx.trial.clock ?? null;
    return null;
  },
};

function mount(props: Partial<LabProps>) {
  return render(
    <div className="lk-present-frame">
      <Lab {...({ instruments: [Timed], defaultInstrument: 'Timed', ...props } as LabProps)} />
    </div>,
  );
}

test('a still is ready once the frame it holds has been drawn, and draws no other', async () => {
  // Read as the class lands, not on the poll's next turn, by when a frame
  // drawn late would have been drawn anyway.
  let drawnWhenReady: number[] | null = null;
  const observer = new MutationObserver(() => {
    if (document.querySelector('.lk-lab--still-ready')) drawnWhenReady ??= [...drawn];
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  const { container } = mount({ still: 1200 });
  await expect.poll(() => drawnWhenReady).not.toBeNull();
  observer.disconnect();
  expect(drawnWhenReady).not.toEqual([]);
  expect(new Set(drawn)).toEqual(new Set([1200]));
  expect(container.querySelector('.lk-presented-transport')).toBeNull();

  const count = drawn.length;
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(drawn).toHaveLength(count);
  expect(clock?.elapsed).toBe(1200);
});

test('a message posted to the page plays and pauses the lab in it', async () => {
  mount({ present: true });
  await expect.poll(() => clock).not.toBeNull();
  window.postMessage({ type: 'labkit:pause' }, location.origin);
  await expect.poll(() => clock?.rate).toBe(0);
  const paused = clock?.elapsed ?? 0;
  window.postMessage({ type: 'labkit:play' }, location.origin);
  await expect.poll(() => clock?.rate).toBe(1);
  await expect.poll(() => clock?.elapsed ?? 0).toBeGreaterThan(paused);
});
