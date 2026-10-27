import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './presentation.browser.test.less';
import { cleanup } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, expect, test } from 'vitest';
import type { TrialClock } from '../clock/trialClock';
import type { Instrument } from '../instrument/types';
import { it as liveTest } from '../testing/liveTest';
import { Lab } from './Lab';
import type { LabProps } from './labProps';

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

function mount(props: Partial<LabProps>, instrument: Instrument = Timed) {
  return renderWithIcons(
    <div className="lk-present-frame">
      <Lab {...({ instruments: [instrument], defaultInstrument: 'Timed', ...props } as LabProps)} />
    </div>,
  );
}

/** Resolves with what had been drawn when the still said it was ready: read as
 *  the class lands, not on a poll's next turn, by when a frame drawn late
 *  would have been drawn anyway. */
async function drawnAtReady(): Promise<number[]> {
  let seen: number[] | null = null;
  const observer = new MutationObserver(() => {
    if (document.querySelector('.lk-lab--still-ready')) seen ??= [...drawn];
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  await expect.poll(() => seen).not.toBeNull();
  observer.disconnect();
  return seen ?? [];
}

test('a still is ready once the frame it holds has been drawn, and draws no other', async () => {
  const ready = drawnAtReady();
  const { container } = mount({ still: 1200 });
  const drawnWhenReady = await ready;
  expect(drawnWhenReady).not.toEqual([]);
  expect(new Set(drawn)).toEqual(new Set([1200]));
  expect(container.querySelector('.lk-presented-transport')).toBeNull();

  const count = drawn.length;
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(drawn).toHaveLength(count);
  expect(clock?.elapsed).toBe(1200);
});

test('a still of a clock that is not seekable draws the time it was run forward to', async () => {
  const Running: Instrument = { ...Timed, clock: { rate: 1, seekable: false, step: 50 } };
  const ready = drawnAtReady();
  mount({ still: 1200 }, Running);
  expect((await ready).at(-1)).toBe(1200);
  const count = drawn.length;
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(drawn).toHaveLength(count);
  expect(clock?.elapsed).toBe(1200);
});

liveTest('a message posted to the page plays and pauses the lab in it', async ({ live }) => {
  const post = live((type: string) => window.postMessage({ type }, location.origin));
  mount({ present: true });
  await expect.poll(() => clock).not.toBeNull();
  post('labkit:pause');
  await expect.poll(() => clock?.rate).toBe(0);
  const paused = clock?.elapsed ?? 0;
  post('labkit:play');
  await expect.poll(() => clock?.rate).toBe(1);
  await expect.poll(() => clock?.elapsed ?? 0).toBeGreaterThan(paused);
});
