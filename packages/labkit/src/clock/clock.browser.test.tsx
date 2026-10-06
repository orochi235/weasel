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
          ctx.fillStyle = `rgb(${Math.floor(elapsed / 16) % 256}, 0, 0)`;
          ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
        },
      },
    ],
  },
  render: (ctx) => (
    <button
      type="button"
      onClick={() => {
        if (ctx.trial.clock) ctx.trial.clock.rate = 0;
      }}
    >
      pause
    </button>
  ),
};

/** The red channel at the middle of the layer's canvas. */
function red(): number {
  const canvas = document.querySelector('.lk-clock-frame .lk-canvas-stack__canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  return ctx.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[0] ?? -1;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('a timed layer repaints as the clock plays, and holds once it pauses', async () => {
  render(
    <div className="lk-clock-frame">
      <Lab title="T" instruments={[Ticking]} defaultInstrument="Ticking" />
    </div>,
  );
  // Layout settles first — the first measurement places the view and repaints
  // every layer — so only the clock can repaint after it.
  await wait(500);
  const a = red();
  await wait(150);
  const b = red();
  await wait(150);
  expect(b).not.toBe(a);
  expect(red()).not.toBe(b);

  fireEvent.click(screen.getByRole('button', { name: 'pause' }));
  await wait(100);
  const held = red();
  await wait(300);
  expect(red()).toBe(held);
});
