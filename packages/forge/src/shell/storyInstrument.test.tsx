import { Lab, LabContext, type LabContextValue } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Channel, openChannel } from '../protocol/channel';
import { type FromFrame, PORT_HANDOFF, stableStringify, type ToFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { createAnswerBook } from './answers';
import { storyInstrument } from './storyInstrument';

const entry: IndexEntry = {
  id: 'test-counter--counter',
  title: 'Test/Counter',
  name: 'Counter',
  exportName: 'Counter',
  file: '/x.stories.tsx',
};
type Ready = Extract<FromFrame, { type: 'ready' }>;
const ready: Ready = {
  type: 'ready',
  schema: describeSchema(f.schema({ label: f.string('clicks') })),
  layout: 'centered',
  viewport: null,
};
const globals = { theme: 'dark' };

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await act(async () => {});
}

describe('storyInstrument', () => {
  const base = { entry, answers: createAnswerBook(), frameUrl: '/frame.html', onReady: () => {}, globals };

  it('is provisional without a ready: empty defaults, null state, no stage', () => {
    const instrument = storyInstrument(base);
    expect(instrument.name).toBe(entry.id);
    expect(instrument.config?.defaults()).toEqual({});
    expect(instrument.defaultConfig()).toEqual({});
    expect(instrument.initialState({})).toBeNull();
    expect(instrument.stage).toBeUndefined();
  });

  it('takes its defaults from the ready description', () => {
    expect(storyInstrument({ ...base, ready }).config?.defaults()).toEqual({ label: 'clicks' });
  });

  it('declares a stage of the story’s viewport', () => {
    const instrument = storyInstrument({ ...base, ready: { ...ready, viewport: { width: 320, height: 200 } } });
    expect(instrument.stage).toEqual({ size: { width: 320, height: 200 } });
  });
});

// The forge project runs without labkit's test setup, and a lab's tiled surface needs a measured, non-zero box.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      const contentRect = { width: 1024, height: 768, x: 0, y: 0, top: 0, left: 0 };
      this.#cb([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

let lab: LabContextValue | null = null;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
  vi.useRealTimers();
});

function labWith(instrumentReady: Ready | undefined, onReady = vi.fn(), answers = createAnswerBook()) {
  const instrument = storyInstrument({ entry, ready: instrumentReady, answers, frameUrl: '/frame.html', onReady, globals });
  return (
    <Lab instruments={[instrument]} defaultInstrument={entry.id}>
      <LabContext.Consumer>
        {(value) => {
          lab = value;
          return null;
        }}
      </LabContext.Consumer>
    </Lab>
  );
}

/** Loads the iframe by hand and plays the frame's half of the handoff. */
function connect(iframe: HTMLIFrameElement) {
  const post = vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(() => {});
  fireEvent.load(iframe);
  const call = post.mock.calls.at(-1) as unknown[] | undefined;
  expect(call?.[0]).toEqual({ type: PORT_HANDOFF });
  const port = (call?.[2] as MessagePort[])[0] as MessagePort;
  const frame: Channel<ToFrame, FromFrame> = openChannel(port);
  const received: ToFrame[] = [];
  frame.on((msg) => received.push(msg));
  cleanups.push(() => frame.close());
  return { frame, received, port };
}

function mount(onReady = vi.fn(), answers = createAnswerBook()) {
  lab = null;
  const view = render(labWith(ready, onReady, answers));
  const iframe = view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
  return { view, iframe, onReady, answers, ...connect(iframe) };
}

const config = () => lab?.trials[0]?.config;
const state = () => lab?.trials[0]?.state;

describe('FrameView', () => {
  it('points the iframe at the story', () => {
    const { iframe } = mount();
    expect(iframe.getAttribute('src')).toBe(`/frame.html#${entry.id}`);
    expect(iframe.title).toBe('Test/Counter / Counter');
  });

  it('sends nothing before ready, then init with the trial’s config, state and globals', async () => {
    const { frame, received, onReady } = mount();
    await flush();
    expect(received).toEqual([]);
    frame.send(ready);
    await flush();
    expect(onReady).toHaveBeenCalledWith(entry, ready);
    expect(received).toEqual([{ type: 'init', config: { label: 'clicks' }, state: null, globals }]);
  });

  it('applies a frame setConfig to the trial and sends the config back', async () => {
    const { frame, received } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'setConfig', path: 'label', value: 'renamed' });
    await flush();
    expect(config()).toEqual({ label: 'renamed' });
    expect(received.at(-1)).toEqual({ type: 'config', config: { label: 'renamed' } });
  });

  it('applies a frame setState without echoing it back', async () => {
    const { frame, received } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'setState', state: { n: 3 } });
    await flush();
    expect(state()).toEqual({ n: 3 });
    expect(received.map((m) => m.type)).toEqual(['init']);
  });

  it('sends a state the trial set itself', async () => {
    const { frame, received } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'setState', state: { n: 1 } });
    await flush();
    act(() => lab?.resetTrial(lab.trials[0]?.id ?? ''));
    await flush();
    expect(received.filter((m) => m.type === 'state')).toEqual([{ type: 'state', state: null }]);
  });

  it('records answers in the story’s answer book', async () => {
    const { frame, answers } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'answers', answers: { configKey: stableStringify({ label: 'clicks' }), hidden: ['label'], errors: {} } });
    await flush();
    expect(answers.hidden('label', { label: 'clicks' })).toBe(true);
  });

  it('shows a fault over the iframe until the next ready', async () => {
    const { view, iframe, frame } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'fault', phase: 'render', message: 'bad config' });
    await flush();
    const fault = view.container.querySelector('.fg-fault');
    expect(fault?.textContent).toContain('render');
    expect(fault?.textContent).toContain('bad config');
    expect(view.container.querySelector('iframe')).toBe(iframe);
    frame.send(ready);
    await flush();
    expect(view.container.querySelector('.fg-fault')).toBeNull();
  });

  it('faults when the frame never says ready', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { view } = mount();
    act(() => vi.advanceTimersByTime(10_000));
    expect(view.container.querySelector('.fg-fault')?.textContent).toContain(
      `Frame did not start: /frame.html#${entry.id}`,
    );
  });

  it('names the protocol version a mismatched frame speaks', async () => {
    const { view, port } = mount();
    port.postMessage({ v: 2, msg: ready });
    await flush();
    const fault = view.container.querySelector('.fg-fault');
    expect(fault?.textContent).toContain('protocol');
    expect(fault?.textContent).toContain('Frame speaks protocol 2; this workshop speaks 1');
  });

  it('says when a frame sends something that is not an envelope', async () => {
    const { view, port } = mount();
    port.postMessage({ type: 'ready' });
    await flush();
    expect(view.container.querySelector('.fg-fault')?.textContent).toContain(
      'Frame sent a message that is not a forge envelope',
    );
  });

  it('hands off a fresh port and re-sends init after the frame reloads', async () => {
    const { iframe, frame } = mount();
    frame.send(ready);
    await flush();
    const again = connect(iframe);
    again.frame.send(ready);
    await flush();
    expect(again.received).toEqual([{ type: 'init', config: { label: 'clicks' }, state: null, globals }]);
  });

  it('keeps the same iframe when the instrument is replaced', async () => {
    const { view, iframe } = mount();
    view.rerender(labWith({ ...ready, schema: describeSchema(f.schema({ label: f.string('clicks'), n: f.number(1) })) }));
    await flush();
    expect(view.container.querySelector('iframe')).toBe(iframe);
    expect(config()).toEqual({ label: 'clicks', n: 1 });
  });
});
