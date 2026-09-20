import { f } from '@weasel-js/labkit/config';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openChannel } from '../protocol/channel';
import type { FromFrame, ToFrame } from '../protocol/messages';
import { meta, story } from '../story/define';
import { loadNativeModule } from '../story/native';
import { captureElement } from './capture';
import { startFrame } from './FrameController';

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await act(async () => {});
}

const parse = (markup: string) => new DOMParser().parseFromString(markup, 'image/svg+xml');

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) act(() => fn());
});

describe('captureElement', () => {
  it('wraps the element in a foreignObject that parses as XML', () => {
    const host = document.createElement('div');
    host.innerHTML = '<p>first<br>second</p>';
    document.body.append(host);
    cleanups.push(() => host.remove());

    const picture = captureElement(host);
    expect(picture.kind).toBe('svg');
    const doc = parse(picture.markup);
    // An unclosed `<br>` is what an HTML serialization would have left behind.
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.localName).toBe('svg');
    expect(doc.documentElement.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    expect(doc.getElementsByTagName('foreignObject')).toHaveLength(1);
    expect(doc.documentElement.textContent).toContain('second');
  });

  it('restates the document’s custom properties on the capture root, which no :root rule reaches', () => {
    const sheet = document.createElement('style');
    sheet.textContent = ':root{--fg-probe:#123456}.probe{color:var(--fg-probe)}';
    document.head.append(sheet);
    const host = document.createElement('div');
    host.innerHTML = '<span class="probe">x</span>';
    document.body.append(host);
    cleanups.push(() => {
      host.remove();
      sheet.remove();
    });

    const markup = captureElement(host).markup;
    expect(markup).toContain('[data-fg-capture]{');
    expect(markup).toContain('--fg-probe: #123456;');
  });
});

describe('startFrame capture.run', () => {
  it('answers with the story’s own markup, under the id that was asked', async () => {
    const loaded = loadNativeModule(
      {
        default: meta({ title: 'Test/Shape' }),
        Shape: story({
          config: f.schema({ label: f.string('hello') }),
          render: ({ config }) => <p data-probe="">{config.label}</p>,
        }),
      },
      'Test/Auto',
    )[0]!;

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

    await flush();
    shell.send({ type: 'init', config: { label: 'hello' }, state: null, globals: {} });
    await flush();
    shell.send({ type: 'capture.run', id: 'cap-1' });
    await flush();

    const answer = received.find((m) => m.type === 'capture');
    expect(answer).toMatchObject({ type: 'capture', id: 'cap-1', ok: true });
    if (answer?.type !== 'capture' || !answer.ok) throw new Error('no picture');
    expect(answer.picture.kind).toBe('svg');
    if (answer.picture.kind !== 'svg') throw new Error('not svg');
    const doc = parse(answer.picture.markup);
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.textContent).toContain('hello');
  });
});
