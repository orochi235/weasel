import { expect, it } from 'vitest';

// The engine reports a started voice's ending from its source's `ended`. A
// voice stolen or stopped inside the lookahead is stopped ahead of its own
// start time and disconnected at once, and only a real engine says whether
// `ended` still comes.

const RATE = 48000;
const FRAMES = 9600;

async function endedAfterEarlyStop(
  make: (ctx: OfflineAudioContext) => AudioScheduledSourceNode,
): Promise<boolean> {
  const ctx = new OfflineAudioContext(1, FRAMES, RATE);
  const source = make(ctx);
  let ended = false;
  source.onended = () => { ended = true; };
  source.connect(ctx.destination);
  source.start(0.05);
  source.stop();
  source.disconnect();
  await ctx.startRendering();
  await new Promise((resolve) => { setTimeout(resolve, 50); });
  return ended;
}

it('raises `ended` on a buffer source stopped before its start time', async () => {
  expect(await endedAfterEarlyStop((ctx) => {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 480, RATE);
    return source;
  })).toBe(true);
});

it('raises `ended` on an oscillator stopped before its start time', async () => {
  expect(await endedAfterEarlyStop((ctx) => ctx.createOscillator())).toBe(true);
});
