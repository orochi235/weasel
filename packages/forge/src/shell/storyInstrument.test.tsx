import { Lab, LabContext, type LabContextValue, type InstrumentList, type RenderContext } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Channel, openChannel } from '../protocol/channel';
import { FRAME_HELLO, type FromFrame, type Globals, PORT_HANDOFF, stableStringify, type ToFrame } from '../protocol/messages';
import { type FramePool, FramePoolContext } from './framePool';
import { sayHello } from './labHarness';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { createAnswerBook } from './answers';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { storyInstrument } from './storyInstrument';
import { useStoryRegistry } from './useStoryRegistry';

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

// Captured before any test fakes timers, so a flush still yields to the port.
const realSetTimeout = globalThis.setTimeout;
async function flush() {
  await new Promise((r) => realSetTimeout(r, 0));
  await act(async () => {});
}

describe('storyInstrument', () => {
  const base = { entry, answers: createAnswerBook(), frameUrl: '/frame.html', onReady: () => {} };

  it('is provisional without a ready: empty defaults, null state, no stage', () => {
    const instrument = storyInstrument(base);
    expect(instrument.name).toBe(entry.id);
    expect(instrument.config?.defaults()).toEqual({});
    expect(instrument.defaultConfig()).toEqual({});
    expect(instrument.initialState({})).toBeNull();
    expect(instrument.stage).toBeUndefined();
  });

  it('titles itself by the story’s title and name', () => {
    expect(storyInstrument(base).title).toBe('Test/Counter / Counter');
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
let ctx: RenderContext<unknown, unknown> | null = null;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
  vi.useRealTimers();
});

function captureLab() {
  return (
    <LabContext.Consumer>
      {(value) => {
        lab = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

function labWith(
  instrumentReady: Ready | undefined,
  onReady = vi.fn(),
  answers = createAnswerBook(),
  labGlobals: Globals = globals,
) {
  const instrument = storyInstrument({ entry, ready: instrumentReady, answers, frameUrl: '/frame.html', onReady });
  const capturing = {
    ...instrument,
    render: (renderCtx: RenderContext<unknown, unknown>) => {
      ctx = renderCtx;
      return instrument.render(renderCtx);
    },
  };
  return (
    <StoryGlobalsContext.Provider value={labGlobals}>
      <Lab instruments={[capturing]} defaultInstrument={entry.id}>
        {captureLab()}
      </Lab>
    </StoryGlobalsContext.Provider>
  );
}

/** Plays the frame's half of the handoff. */
function connect(iframe: HTMLIFrameElement) {
  const post = vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(() => {});
  sayHello(iframe);
  const call = post.mock.calls.at(-1) as unknown[] | undefined;
  expect(call?.[0]).toEqual({ type: PORT_HANDOFF, id: entry.id });
  expect(call?.[1]).toBe(location.origin);
  const port = (call?.[2] as MessagePort[])[0] as MessagePort;
  const frame: Channel<ToFrame, FromFrame> = openChannel(port);
  const received: ToFrame[] = [];
  frame.on((msg) => received.push(msg));
  cleanups.push(() => frame.close());
  return { frame, received, port };
}

function mountWith(instrumentReady: Ready | undefined, onReady = vi.fn(), answers = createAnswerBook()) {
  lab = null;
  ctx = null;
  const view = render(labWith(instrumentReady, onReady, answers));
  const iframe = view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
  return { view, iframe, onReady, answers, ...connect(iframe) };
}

const mount = (onReady = vi.fn(), answers = createAnswerBook()) => mountWith(ready, onReady, answers);

const config = () => lab?.trials[0]?.config;
const state = () => lab?.trials[0]?.state;
const faultText = (container: HTMLElement) => container.querySelector('.fg-fault')?.textContent ?? null;

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

  it('holds init until its instrument describes the frame, then sends the real defaults', async () => {
    const grid: Ready = { ...ready, schema: describeSchema(f.schema({ grid: f.group({ size: f.number(4) }) })) };
    const { view, frame, received, onReady } = mountWith(undefined);
    frame.send(grid);
    await flush();
    expect(onReady).toHaveBeenCalledWith(entry, grid);
    expect(received).toEqual([]);
    view.rerender(labWith(grid, onReady));
    await flush();
    expect(received).toEqual([{ type: 'init', config: { grid: { size: 4 } }, state: null, globals }]);
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

  it('sends the frame’s own earlier state when the trial returns to it', async () => {
    const { frame, received } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'setState', state: { n: 1 } });
    await flush();
    const a = state();
    const b = { n: 2 };
    act(() => ctx?.setState(b));
    await flush();
    act(() => ctx?.setState(a));
    await flush();
    expect(received.filter((m) => m.type === 'state')).toEqual([
      { type: 'state', state: b },
      { type: 'state', state: { n: 1 } },
    ]);
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

  it('clears a render fault when new input goes to the frame, until the frame faults again', async () => {
    const { view, frame, received } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'fault', phase: 'render', message: 'bad config' });
    await flush();
    expect(faultText(view.container)).toContain('bad config');
    act(() => ctx?.setConfig('label', 'fixed?'));
    await flush();
    expect(received.at(-1)).toEqual({ type: 'config', config: { label: 'fixed?' } });
    expect(faultText(view.container)).toBeNull();
    frame.send({ type: 'fault', phase: 'render', message: 'still bad' });
    await flush();
    expect(faultText(view.container)).toContain('still bad');
  });

  it('ignores a render fault from before the latest input, and shows one from the latest', async () => {
    const { view, frame, received } = mount();
    frame.send(ready);
    await flush();
    act(() => ctx?.setConfig('label', 'one'));
    await flush();
    act(() => ctx?.setConfig('label', 'two'));
    await flush();
    expect(received.map((m) => m.type)).toEqual(['init', 'config', 'config']);
    frame.send({ type: 'fault', phase: 'render', message: 'stale', seq: 2 });
    await flush();
    expect(faultText(view.container)).toBeNull();
    frame.send({ type: 'fault', phase: 'render', message: 'current', seq: 3 });
    await flush();
    expect(faultText(view.container)).toContain('current');
  });

  it('sends one init when onReady synchronously builds the instrument that describes the frame', async () => {
    function SyncReady() {
      const [held, setHeld] = useState<Ready | undefined>(undefined);
      return labWith(
        held,
        vi.fn((_entry: IndexEntry, next: Ready) => flushSync(() => setHeld(next))),
      );
    }
    const view = render(<SyncReady />);
    const { frame, received } = connect(view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
    frame.send(ready);
    await flush();
    expect(received).toEqual([{ type: 'init', config: { label: 'clicks' }, state: null, globals }]);
  });

  it('keeps an import fault when new input goes to the frame', async () => {
    const { view, frame } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'fault', phase: 'import', message: 'no module' });
    await flush();
    act(() => ctx?.setConfig('label', 'other'));
    await flush();
    expect(faultText(view.container)).toContain('no module');
  });

  it('faults when the frame never says ready', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { view } = mount();
    act(() => vi.advanceTimersByTime(10_000));
    expect(faultText(view.container)).toContain(`Frame did not start: /frame.html#${entry.id}`);
  });

  it('keeps a fault that arrived before ready past the start timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { view, frame } = mount();
    frame.send({ type: 'fault', phase: 'import', message: 'no module' });
    await flush();
    act(() => vi.advanceTimersByTime(10_000));
    const text = faultText(view.container);
    expect(text).toContain('import');
    expect(text).toContain('no module');
    expect(text).not.toContain('Frame did not start');
  });

  it('keeps a protocol mismatch past the start timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { view, port } = mount();
    port.postMessage({ v: 2, msg: ready });
    await flush();
    act(() => vi.advanceTimersByTime(10_000));
    expect(faultText(view.container)).toContain('Frame speaks protocol 2');
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
    expect(faultText(view.container)).toContain('Frame sent a message that is not a forge envelope');
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

  it('ignores the old port after the frame reloads', async () => {
    const { iframe, frame } = mount();
    frame.send(ready);
    await flush();
    const again = connect(iframe);
    again.frame.send(ready);
    await flush();
    frame.send({ type: 'setConfig', path: 'label', value: 'stale' });
    await flush();
    expect(config()).toEqual({ label: 'clicks' });
  });

  it('keeps the same iframe when the instrument is replaced', async () => {
    const { view, iframe } = mount();
    view.rerender(labWith({ ...ready, schema: describeSchema(f.schema({ label: f.string('clicks'), n: f.number(1) })) }));
    await flush();
    expect(view.container.querySelector('iframe')).toBe(iframe);
    expect(config()).toEqual({ label: 'clicks', n: 1 });
  });

  it('swaps its trial to the story a frame asks to open, in place, and names it in the route', async () => {
    const other: IndexEntry = { ...entry, id: 'test-counter--other', name: 'Other', exportName: 'Other' };
    const instrument = (e: IndexEntry) =>
      storyInstrument({ entry: e, ready, answers: createAnswerBook(), frameUrl: '/frame.html', onReady: vi.fn() });
    lab = null;
    const view = render(
      <StoryGlobalsContext.Provider value={globals}>
        <Lab instruments={[instrument(entry), instrument(other)]} defaultInstrument={entry.id}>
          {captureLab()}
        </Lab>
      </StoryGlobalsContext.Provider>,
    );
    cleanups.push(() => history.replaceState(null, '', '/'));
    const { frame } = connect(view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
    frame.send({ type: 'open', id: 'no-such-story' });
    await flush();
    expect((lab as LabContextValue | null)?.trials.map((trial) => trial.instrumentName)).toEqual([entry.id]);
    frame.send({ type: 'open', id: other.id });
    await flush();
    expect((lab as LabContextValue | null)?.trials.map((trial) => trial.instrumentName)).toEqual([other.id]);
    expect(location.hash).toBe(`#/${other.id}`);
  });
});


const handoffs = (post: { mock: { calls: unknown[][] } }) =>
  post.mock.calls.filter((c) => (c[0] as { type?: unknown } | null)?.type === PORT_HANDOFF);

describe('FrameView handshake', () => {
  it('hands off a port on each hello and never on load, which a browser fires before the hello', () => {
    const view = render(labWith(ready));
    const iframe = view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
    const post = vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(() => {});
    fireEvent.load(iframe);
    expect(handoffs(post)).toHaveLength(0);
    sayHello(iframe);
    expect(handoffs(post)).toHaveLength(1);
    sayHello(iframe);
    expect(handoffs(post)).toHaveLength(2);
  });

  it('faults when the frame document never says hello', () => {
    vi.useFakeTimers();
    const view = render(labWith(ready));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(faultText(view.container)).toBe('Frame did not start: /frame.html#test-counter--counter');
  });

  it('ignores a hello from a window other than its frame', () => {
    const view = render(labWith(ready));
    const iframe = view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
    const post = vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(() => {});
    const stray = new MessageEvent('message', { data: { type: FRAME_HELLO }, origin: location.origin });
    Object.defineProperty(stray, 'source', { value: window });
    act(() => {
      window.dispatchEvent(stray);
    });
    expect(handoffs(post)).toHaveLength(0);
  });

  // Proxy: jsdom has no `moveBefore`, and moving an iframe any other way gives it a new window. So this asserts
  // the call that keeps the document alive, not that it stayed alive; the browser is what shows that.
  it('moves a claimed frame into place and hands it a port at once, without loading it again', () => {
    const proto = Element.prototype as Element & { moveBefore?: (node: Node, child: Node | null) => void };
    const moveBefore = vi.fn();
    proto.moveBefore = moveBefore;
    cleanups.push(() => Reflect.deleteProperty(proto, 'moveBefore'));
    const warm = document.createElement('iframe');
    document.body.append(warm);
    cleanups.push(() => warm.remove());
    const post = vi.spyOn(warm.contentWindow as Window, 'postMessage').mockImplementation(() => {});
    const pool: FramePool = { claim: vi.fn(() => warm), dispose: () => {} };
    const view = render(<FramePoolContext.Provider value={pool}>{labWith(ready)}</FramePoolContext.Provider>);
    expect(moveBefore).toHaveBeenCalledWith(warm, null);
    expect(moveBefore.mock.contexts[0]).toBe(view.container.querySelector('.fg-frame-slot'));
    expect(warm.className).toBe('fg-frame-view');
    expect(warm.hasAttribute('src')).toBe(false);
    expect(handoffs(post)).toEqual([[{ type: PORT_HANDOFF, id: entry.id }, location.origin, [expect.any(MessagePort)]]]);
  });
});

describe('FrameView with declared globals', () => {
  const declarations = {
    theme: {
      label: 'Theme',
      default: 'dark',
      options: [
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
      ],
    },
  };

  function mountGlobals() {
    lab = null;
    ctx = null;
    const instrument = storyInstrument({
      entry,
      ready,
      answers: createAnswerBook(),
      frameUrl: '/frame.html',
      onReady: vi.fn(),
      globals: declarations,
    });
    const capturing = {
      ...instrument,
      render: (renderCtx: RenderContext<unknown, unknown>) => {
        ctx = renderCtx;
        return instrument.render(renderCtx);
      },
    };
    const view = render(
      <StoryGlobalsContext.Provider value={globals}>
        <Lab instruments={[capturing]} defaultInstrument={entry.id}>
          {captureLab()}
        </Lab>
      </StoryGlobalsContext.Provider>,
    );
    return { view, ...connect(view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement) };
  }

  it('sends init with the story’s config alone and the lab’s globals', async () => {
    const { frame, received } = mountGlobals();
    frame.send(ready);
    await flush();
    expect(config()).toEqual({ label: 'clicks', $globals: { theme: 'lab' } });
    expect(received).toEqual([{ type: 'init', config: { label: 'clicks' }, state: null, globals }]);
  });

  it('sends a pinned global as globals, and no config, until the pin follows the lab again', async () => {
    const { frame, received } = mountGlobals();
    frame.send(ready);
    await flush();
    act(() => ctx?.setConfig('$globals.theme', 'light'));
    await flush();
    expect(received.slice(1)).toEqual([{ type: 'globals', globals: { theme: 'light' } }]);
    act(() => ctx?.setConfig('label', 'renamed'));
    await flush();
    expect(received.at(-1)).toEqual({ type: 'config', config: { label: 'renamed' } });
    act(() => ctx?.setConfig('$globals.theme', 'lab'));
    await flush();
    expect(received.at(-1)).toEqual({ type: 'globals', globals });
    expect(received.map((m) => m.type)).toEqual(['init', 'globals', 'config', 'globals']);
  });

  it('drops a frame setConfig aimed at the pins', async () => {
    const { frame, received } = mountGlobals();
    frame.send(ready);
    await flush();
    frame.send({ type: 'setConfig', path: '$globals.theme', value: 'light' });
    frame.send({ type: 'setConfig', path: '$globals', value: { theme: 'light' } });
    await flush();
    expect(config()).toEqual({ label: 'clicks', $globals: { theme: 'lab' } });
    expect(received.map((m) => m.type)).toEqual(['init']);
  });
});

describe('FrameView under a story registry', () => {
  function RegistryLab({ labGlobals, lists }: { labGlobals: Globals; lists: InstrumentList[] }) {
    const registry = useStoryRegistry([entry], { frameUrl: '/frame.html' });
    lists.push(registry.instruments);
    return (
      <StoryGlobalsContext.Provider value={labGlobals}>
        <Lab instruments={registry.instruments} defaultInstrument={entry.id}>
          {captureLab()}
        </Lab>
      </StoryGlobalsContext.Provider>
    );
  }

  it('sends new globals to the frame without replacing the instruments', async () => {
    const lists: InstrumentList[] = [];
    const view = render(<RegistryLab labGlobals={globals} lists={lists} />);
    const { frame, received } = connect(view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
    frame.send(ready);
    await flush();
    expect(received).toEqual([{ type: 'init', config: { label: 'clicks' }, state: null, globals }]);
    const settled = lists.at(-1);
    view.rerender(<RegistryLab labGlobals={{ theme: 'light' }} lists={lists} />);
    await flush();
    expect(received.at(-1)).toEqual({ type: 'globals', globals: { theme: 'light' } });
    expect(lists.at(-1)).toBe(settled);
  });
});

describe('FrameView out of view', () => {
  let observers: { cb: IntersectionObserverCallback; targets: Element[] }[] = [];
  const setInView = (isIntersecting: boolean) =>
    act(() => {
      for (const o of observers) {
        o.cb(
          o.targets.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry),
          o as unknown as IntersectionObserver,
        );
      }
    });

  afterEach(() => {
    observers = [];
    vi.unstubAllGlobals();
  });

  function stubIntersectionObserver() {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        cb: IntersectionObserverCallback;
        targets: Element[] = [];
        constructor(cb: IntersectionObserverCallback) {
          this.cb = cb;
          observers.push(this);
        }
        observe(target: Element) {
          this.targets.push(target);
        }
        unobserve(target: Element) {
          this.targets = this.targets.filter((t) => t !== target);
        }
        disconnect() {
          this.targets = [];
          observers = observers.filter((o) => o !== this);
        }
      },
    );
  }

  it('unmounts the frame while its trial is out of view and resumes it with the trial’s config and state', async () => {
    stubIntersectionObserver();
    const { view, frame } = mount();
    frame.send(ready);
    await flush();
    frame.send({ type: 'setConfig', path: 'label', value: 'renamed' });
    frame.send({ type: 'setState', state: { n: 3 } });
    await flush();

    setInView(false);
    expect(view.container.querySelector('iframe')).toBeNull();

    setInView(true);
    const iframe = view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.hasAttribute('data-pending')).toBe(true);
    const back = connect(iframe);
    back.frame.send(ready);
    await flush();
    expect(back.received).toEqual([{ type: 'init', config: { label: 'renamed' }, state: { n: 3 }, globals }]);
  });

  it('keeps the frame mounted where the browser has no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { view } = mount();
    expect(view.container.querySelector('iframe.fg-frame-view')).not.toBeNull();
  });
});
