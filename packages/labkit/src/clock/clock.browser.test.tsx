import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './clock.browser.test.less';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';

// The lab's frame loop syncing a trial clock and a timed layer repainting from
// it: real frames and real pixels, which only a browser has.

afterEach(cleanup);

const shade = (elapsed: number) => Math.floor(elapsed / 16) % 256;
/** The `elapsed` of every paint of the layer, in order. */
let painted: number[] = [];
/** The clock's `elapsed` when the pause button stopped it. */
let pausedAt = Number.NaN;

/** Fills the view with a red that steps with the clock, 1 a frame-ish. */
const Ticking: Instrument = {
  name: 'Ticking',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  clock: { rate: 1 },
  canvas: {
    layers: [
      {
        id: 'tick',
        timed: true,
        draw: (ctx, { elapsed }) => {
          painted.push(elapsed);
          ctx.fillStyle = `rgb(${shade(elapsed)}, 0, 0)`;
          ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
        },
      },
    ],
  },
  render: (ctx) => (
    <button
      type="button"
      onClick={() => {
        if (!ctx.trial.clock) return;
        ctx.trial.clock.rate = 0;
        pausedAt = ctx.trial.clock.elapsed;
      }}
    >
      pause
    </button>
  ),
};

/** The red channel at the middle of the layer's canvas. */
function red(): number {
  const canvas = document.querySelector(
    '.lk-clock-frame .lk-canvas-stack__canvas',
  ) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  return ctx.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[0] ?? -1;
}

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame);
};

// Every wait is on paints the layer reports, never on wall-clock time: under a
// loaded full run a frame can land long after any fixed budget.
const POLL = { timeout: 10_000 };

test('a timed layer repaints as the clock plays, and holds once it pauses', async () => {
  painted = [];
  pausedAt = Number.NaN;
  render(
    <div className="lk-clock-frame">
      <Lab title="T" instruments={[Ticking]} defaultInstrument="Ticking" />
    </div>,
  );
  // Paints at three distinct times: only the clock moving explains that, since
  // a layout repaint reads the same `elapsed` as the paint before it. Early
  // paints can land before layout sizes the canvas, which wipes them, so the
  // pixel is checked against the latest paint rather than once.
  await expect
    .poll(() => new Set(painted).size >= 3 && red() === shade(painted.at(-1) ?? -1), POLL)
    .toBe(true);

  fireEvent.click(screen.getByRole('button', { name: 'pause' }));
  // A frame queued before the click still paints; wait until one has painted
  // the time the clock stopped at.
  await expect.poll(() => painted.at(-1), POLL).toBe(pausedAt);
  const held = red();
  expect(held).toBe(shade(pausedAt));
  const since = painted.length;
  await frames(20);
  expect(painted.slice(since).every((e) => e === pausedAt)).toBe(true);
  expect(red()).toBe(held);
});
