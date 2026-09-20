import { f } from '@weasel-js/labkit/config';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openChannel } from '../protocol/channel';
import type { FromFrame, ToFrame } from '../protocol/messages';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import type { LoadedStory } from '../story/types';
import { runAxe } from './a11y';
import { startFrame } from './FrameController';

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await act(async () => {});
}

/** axe takes tens of milliseconds, so its answer needs waiting for rather than a fixed number of flushes. */
async function until<T>(read: () => T | undefined): Promise<T> {
  for (let tries = 0; tries < 400; tries++) {
    const value = read();
    if (value !== undefined) return value;
    await flush();
  }
  throw new Error('waited for an answer that never came');
}

/** An image with no alternative text: axe's `image-alt` rule, which needs no layout to decide. */
const faulty = loadNativeModule(
  {
    default: meta({ title: 'Test/Faulty' }),
    Faulty: story({
      config: f.schema({ src: f.string('cat.png') }),
      render: ({ config }) => <img src={config.src} />,
    }),
  },
  'Test/Auto',
)[0]!;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) act(() => fn());
});

function start(loaded: LoadedStory) {
  const { port1, port2 } = new MessageChannel();
  const shell = openChannel<FromFrame, ToFrame>(port1);
  const frame = openChannel<ToFrame, FromFrame>(port2);
  const received: FromFrame[] = [];
  shell.on((msg) => received.push(msg));
  const container = document.createElement('div');
  document.body.append(container);
  const stop = startFrame({ story: loaded, channel: frame, container });
  cleanups.push(() => {
    stop();
    container.remove();
    shell.close();
    frame.close();
  });
  return { shell, received };
}

describe('runAxe', () => {
  it('reports the rule an element fails, with the selector that reaches it', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<img src="cat.png" id="no-alt">';
    document.body.append(host);
    try {
      const report = await runAxe(host);
      const imageAlt = report.violations.find((v) => v.id === 'image-alt');
      expect(imageAlt).toBeDefined();
      expect(imageAlt?.helpUrl).toContain('image-alt');
      expect(imageAlt?.nodes.map((n) => n.target.join(' '))).toContain('#no-alt');
    } finally {
      host.remove();
    }
  }, 20_000);

  it('counts the rules that passed and the ones no element could be judged by', async () => {
    const host = document.createElement('div');
    host.innerHTML = '<img src="cat.png" alt="a cat">';
    document.body.append(host);
    try {
      const report = await runAxe(host);
      expect(report.violations).toEqual([]);
      expect(report.passes).toBeGreaterThan(0);
      expect(report.inapplicable).toBeGreaterThan(0);
    } finally {
      host.remove();
    }
  }, 20_000);
});

describe('startFrame a11y.run', () => {
  it('answers with the story’s own violations, under the id that was asked', async () => {
    const { shell, received } = start(faulty);
    await flush();
    shell.send({ type: 'init', config: { src: 'cat.png' }, state: null, globals: {} });
    await flush();
    shell.send({ type: 'a11y.run', id: 'req-1' });
    const answer = await until(() => received.find((m) => m.type === 'a11y'));
    expect(answer).toMatchObject({ type: 'a11y', id: 'req-1', ok: true });
    if (answer?.type !== 'a11y' || !answer.ok) throw new Error('no report');
    expect(answer.report.violations.map((v) => v.id)).toContain('image-alt');
  }, 20_000);
});
