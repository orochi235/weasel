import { act } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { openChannel } from '../protocol/channel';
import type { FromFrame, ToFrame } from '../protocol/messages';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import { startFrame } from './FrameController';

// The frame document's own scroll is layout: a real browser's.

const tall = loadNativeModule(
  {
    default: meta({ title: 'Test/Tall' }),
    Tall: story({ render: () => <div style={{ width: 3000, height: 4000 }} /> }),
  },
  'Test/Tall',
)[0]!;

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) act(() => stop());
  window.scrollTo(0, 0);
});

function start() {
  const { port1, port2 } = new MessageChannel();
  const shell = openChannel<FromFrame, ToFrame>(port1);
  const frame = openChannel<ToFrame, FromFrame>(port2);
  const received: FromFrame[] = [];
  shell.on((msg) => received.push(msg));
  const container = document.createElement('div');
  document.body.append(container);
  const stop = startFrame({ story: tall, channel: frame, container });
  stops.push(() => {
    stop();
    container.remove();
    shell.close();
    frame.close();
  });
  act(() => shell.send({ type: 'init', config: {}, state: null, globals: {} }));
  const scrolls = () => received.filter((m) => m.type === 'scroll');
  return { shell, scrolls };
}

it('reports where its document stands, from the start and on each scroll', async () => {
  await page.viewport(400, 300);
  const { scrolls } = start();
  await expect.poll(() => scrolls()).toEqual([{ type: 'scroll', left: 0, top: 0 }]);
  window.scrollTo(30, 250);
  await expect.poll(() => scrolls().at(-1)).toEqual({ type: 'scroll', left: 30, top: 250 });
});

it('scrolls its document to where the shell says', async () => {
  await page.viewport(400, 300);
  const { shell } = start();
  await expect.poll(() => document.documentElement.scrollHeight).toBeGreaterThan(4000);
  shell.send({ type: 'scroll', left: 40, top: 600 });
  await expect.poll(() => [window.scrollX, window.scrollY]).toEqual([40, 600]);
});
