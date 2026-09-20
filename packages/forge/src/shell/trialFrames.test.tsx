import { Lab, LabContext, type LabContextValue, TrialIdContext } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Channel, openChannel } from '../protocol/channel';
import type { A11yReport, FromFrame, ToFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { A11yPanel } from './a11y/A11yPanel';
import { createAnswerBook } from './answers';
import { storyInstrument } from './storyInstrument';
import { createTrialFrames, TrialFramesContext } from './trialFrames';

const entry: IndexEntry = {
  id: 'test-counter--counter',
  title: 'Test/Counter',
  name: 'Counter',
  exportName: 'Counter',
  file: '/x.stories.tsx',
};
const ready = {
  type: 'ready',
  schema: describeSchema(f.schema({ label: f.string('clicks') })),
  layout: 'centered',
  viewport: null,
} as const;

const report: A11yReport = {
  violations: [
    {
      id: 'image-alt',
      impact: 'critical',
      help: 'Images must have alternate text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
      description: 'Ensures <img> elements have alternate text',
      nodes: [{ target: ['#no-alt'], html: '<img src="cat.png">' }],
    },
  ],
  incomplete: [],
  passes: 12,
  inapplicable: 7,
};

const realSetTimeout = globalThis.setTimeout;
async function flush() {
  await new Promise((r) => realSetTimeout(r, 0));
  await act(async () => {});
}

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

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0)) fn();
});

describe('createTrialFrames', () => {
  it('reports nothing for a trial with no frame', () => {
    const frames = createTrialFrames();
    expect(frames.get('t1')).toEqual({ send: null, vars: [], audit: null, a11y: null });
  });

  it('keeps the last audit outcome beside the frame, and drops it on disconnect', () => {
    const frames = createTrialFrames();
    const send = vi.fn();
    const audit = vi.fn(async () => ({ ok: true as const, report }));
    const off = frames.connect('t1', { send, audit });
    frames.reportA11y('t1', { ok: true, report });
    expect(frames.get('t1').a11y).toEqual({ ok: true, report });
    expect(frames.get('t1').audit).toBe(audit);
    off();
    expect(frames.get('t1').a11y).toBeNull();
  });

  it('ignores a report for a trial that never connected', () => {
    const frames = createTrialFrames();
    frames.reportA11y('t1', { ok: false, message: 'nope' });
    expect(frames.get('t1').a11y).toBeNull();
  });
});

describe('FrameView audits its frame', () => {
  it('sends a11y.run, resolves the caller, and records the answer against the trial', async () => {
    const frames = createTrialFrames();
    let lab: LabContextValue | null = null;
    const instrument = storyInstrument({
      entry,
      ready,
      answers: createAnswerBook(),
      frameUrl: '/frame.html',
      onReady: () => {},
    });
    const view = render(
      <TrialFramesContext.Provider value={frames}>
        <Lab instruments={[instrument]} defaultInstrument={entry.id}>
          <LabContext.Consumer>
            {(value) => {
              lab = value;
              return null;
            }}
          </LabContext.Consumer>
        </Lab>
      </TrialFramesContext.Provider>,
    );
    cleanups.push(() => view.unmount());

    const iframe = view.container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement;
    const post = vi.spyOn(iframe.contentWindow as Window, 'postMessage').mockImplementation(() => {});
    fireEvent.load(iframe);
    const port = ((post.mock.calls.at(-1) as unknown[])[2] as MessagePort[])[0] as MessagePort;
    const frame: Channel<ToFrame, FromFrame> = openChannel(port);
    cleanups.push(() => frame.close());
    const received: ToFrame[] = [];
    frame.on((msg) => received.push(msg));

    const trialId = (lab as LabContextValue | null)?.trials[0]?.id as string;
    expect(trialId).toBeTruthy();
    await flush();

    const audit = frames.get(trialId).audit;
    expect(audit).toBeTypeOf('function');
    const pending = audit?.();
    await flush();
    // Held until there is a story to ask about.
    expect(received.some((m) => m.type === 'a11y.run')).toBe(false);
    frame.send({ type: 'rendered' });
    await flush();

    const asked = received.find((m) => m.type === 'a11y.run');
    expect(asked).toBeDefined();
    if (asked?.type !== 'a11y.run') throw new Error('no request');
    frame.send({ type: 'a11y', id: asked.id, ok: true, report });
    await flush();

    await expect(pending).resolves.toEqual({ ok: true, report });
    expect(frames.get(trialId).a11y).toEqual({ ok: true, report });
  });
});

describe('A11yPanel', () => {
  function panel(frames = createTrialFrames()) {
    const view = render(
      <TrialFramesContext.Provider value={frames}>
        <TrialIdContext.Provider value="t1">
          <A11yPanel />
        </TrialIdContext.Provider>
      </TrialFramesContext.Provider>,
    );
    cleanups.push(() => view.unmount());
    return { view, frames };
  }

  it('says so when no frame is connected', () => {
    panel();
    expect(screen.getByText('No frame is connected.')).toBeTruthy();
  });

  it('runs once against a connected frame and lists what it found', async () => {
    const frames = createTrialFrames();
    const audit = vi.fn(async () => {
      frames.reportA11y('t1', { ok: true, report });
      return { ok: true as const, report };
    });
    frames.connect('t1', { send: vi.fn(), audit });
    panel(frames);
    await flush();

    expect(audit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Images must have alternate text')).toBeTruthy();
    expect(screen.getByText('#no-alt')).toBeTruthy();
    expect(screen.getByText(/1 violations/)).toBeTruthy();
  });

  it('re-checks on demand', async () => {
    const frames = createTrialFrames();
    const audit = vi.fn(async () => ({ ok: true as const, report }));
    frames.connect('t1', { send: vi.fn(), audit });
    panel(frames);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Re-check' }));
    });
    expect(audit).toHaveBeenCalledTimes(2);
  });

  it('shows the message when axe could not run', async () => {
    const frames = createTrialFrames();
    frames.connect('t1', { send: vi.fn(), audit: vi.fn(async () => ({ ok: false as const, message: 'boom' })) });
    frames.reportA11y('t1', { ok: false, message: 'boom' });
    panel(frames);
    await flush();
    expect(screen.getByRole('alert').textContent).toContain('boom');
  });
});
