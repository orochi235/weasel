import { LabContext, type LabContextValue, type RenderContext, TrialIdContext } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../protocol/channel';
import type { FromFrame, ToFrame } from '../protocol/messages';
import { describeSchema } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import { createAnswerBook } from './answers';
import { type FramePool, FramePoolContext } from './framePool';
import { FrameView } from './FrameView';
import { connectFrame, flush } from './labHarness';
import { reportFrameScroll, scrollOf } from './loupe/frameScroll';
import { type Ready, readyKey } from './readyKey';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { createTrialFrames, type TrialFrames, TrialFramesContext } from './trialFrames';

const entry: IndexEntry = { id: 'test-live--live', title: 'Test/Live', name: 'Live', exportName: 'Live', file: '/x.stories.tsx' };
const other: IndexEntry = { ...entry, id: 'test-live--other', name: 'Other', exportName: 'Other' };
const ready: Ready = {
  type: 'ready',
  schema: describeSchema(f.schema({ label: f.string('A'), size: f.number(1) })),
  layout: 'centered',
  viewport: null,
};
/** The trial's own frame host, whose scroll a copy follows. */
const main = document.createElement('div');
main.dataset.fgHost = 't1';
const COPY = { id: 't1~lens-a', main, globals: { mode: 'dark' }, args: { label: 'B' } } as const;

let frames: TrialFrames;
let mainSend: (msg: ToFrame) => void;
let lab: LabContextValue;
let pool: FramePool;
let trial: RenderContext<unknown, unknown>;
let setConfig: ReturnType<typeof vi.fn<(path: string, value: unknown) => void>>;
let onReady: ReturnType<typeof vi.fn<(entry: IndexEntry, ready: Ready) => void>>;
const answers = createAnswerBook();
const closers: (() => void)[] = [];

beforeEach(() => {
  frames = createTrialFrames();
  mainSend = vi.fn();
  frames.connect('t1', { send: mainSend, audit: () => Promise.resolve({ ok: false, message: 'none' }) });
  lab = { instruments: [{ name: entry.id }, { name: other.id }], swapTrial: vi.fn() } as unknown as LabContextValue;
  pool = { claim: vi.fn(() => null) } as unknown as FramePool;
  setConfig = vi.fn<(path: string, value: unknown) => void>();
  onReady = vi.fn<(entry: IndexEntry, ready: Ready) => void>();
  trial = {
    config: { label: 'A', size: 1, $globals: { mode: 'light' } },
    state: { count: 5 },
    setConfig,
    setState: vi.fn(),
  } as unknown as RenderContext<unknown, unknown>;
});

afterEach(() => {
  for (const close of closers.splice(0)) close();
  vi.restoreAllMocks();
});

/** A copy of the trial `t1`'s isolated story, or with `null` the trial's own view, its frame's half of the protocol
 *  played by the test. */
async function mountCopy(copy: typeof COPY | null = COPY): Promise<{ frame: Channel<ToFrame, FromFrame>; sent: ToFrame[]; container: HTMLElement }> {
  const { container } = render(
    <LabContext.Provider value={lab}>
      <FramePoolContext.Provider value={pool}>
        <TrialFramesContext.Provider value={frames}>
          <TrialIdContext.Provider value="t1">
            <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
              <FrameView
                entry={entry}
                frameUrl="/frame.html"
                answers={answers}
                onReady={onReady}
                descriptionKey={readyKey(ready)}
                ctx={trial}
                {...(copy ? { copy } : {})}
              />
            </StoryGlobalsContext.Provider>
          </TrialIdContext.Provider>
        </TrialFramesContext.Provider>
      </FramePoolContext.Provider>
    </LabContext.Provider>,
  );
  const { frame, received } = connectFrame(container.querySelector('iframe.fg-frame-view') as HTMLIFrameElement);
  closers.push(() => frame.close());
  frame.send(ready);
  await flush();
  return { frame, sent: received, container };
}

describe('FrameView copy', () => {
  it('loads its own frame and leaves the trial’s registry entry alone', async () => {
    const { container } = await mountCopy();
    const host = container.querySelector<HTMLElement>('.fg-frame-host')!;
    expect(host.dataset.fgHost).toBe('t1~lens-a');
    expect(host.hasAttribute('data-fg-copy')).toBe(true);
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe(`/frame.html#${entry.id}`);
    expect(pool.claim).not.toHaveBeenCalled();
    expect(frames.get('t1').send).toBe(mainSend);
  });

  it('sends init with the comparison’s globals and args', async () => {
    const { sent } = await mountCopy();
    expect(sent[0]).toMatchObject({ type: 'init', globals: { mode: 'dark' }, config: { label: 'B' } });
    expect(sent[0]).toMatchObject({ config: { size: 1 }, state: { count: 5 } });
    expect(onReady).not.toHaveBeenCalled();
  });

  it('does not swap the trial when its story asks to open another', async () => {
    const { frame } = await mountCopy();
    frame.send({ type: 'open', id: other.id });
    await flush();
    expect(lab.swapTrial).not.toHaveBeenCalled();
  });

  it('drops a write to an arg the comparison sets, and passes others to the trial', async () => {
    const { frame } = await mountCopy();
    frame.send({ type: 'setConfig', path: 'label', value: 'x' });
    frame.send({ type: 'setConfig', path: 'size', value: 3 });
    await flush();
    expect(setConfig.mock.calls).toEqual([['size', 3]]);
  });

  it('reports neither its vars nor its audits to the trial’s frame registry', async () => {
    const report = vi.spyOn(frames, 'report');
    const reportA11y = vi.spyOn(frames, 'reportA11y');
    const { frame } = await mountCopy();
    frame.send({ type: 'vars', vars: [] });
    frame.send({ type: 'a11y', id: 'a11y-1', ok: false, message: 'nope' });
    await flush();
    expect(report).not.toHaveBeenCalled();
    expect(reportA11y).not.toHaveBeenCalled();
    expect(frames.get('t1').vars).toEqual([]);
    expect(frames.get('t1').a11y).toBeNull();
  });

  it('scrolls its frame to where the trial’s stands once it has rendered, and again whenever that moves', async () => {
    reportFrameScroll(main, { left: 5, top: 410 });
    const { frame, sent } = await mountCopy();
    expect(sent.filter((m) => m.type === 'scroll')).toEqual([]);
    frame.send({ type: 'rendered' });
    await flush();
    expect(sent.filter((m) => m.type === 'scroll')).toEqual([{ type: 'scroll', left: 5, top: 410 }]);
    reportFrameScroll(main, { left: 0, top: 90 });
    await flush();
    expect(sent.filter((m) => m.type === 'scroll').at(-1)).toEqual({ type: 'scroll', left: 0, top: 90 });
  });

  it('reports nothing of where its own frame stands', async () => {
    const { frame, container } = await mountCopy();
    const host = container.querySelector<HTMLElement>('.fg-frame-host')!;
    const scrolled = vi.fn();
    host.addEventListener('scroll', scrolled);
    frame.send({ type: 'scroll', left: 0, top: 777 });
    await flush();
    expect(scrolled).not.toHaveBeenCalled();
    expect(scrollOf(host)).toEqual({ left: 0, top: 0 });
  });

  it('records no answers in the story’s answer book', async () => {
    const record = vi.spyOn(answers, 'record');
    const { frame } = await mountCopy();
    frame.send({ type: 'answers', answers: { configKey: '{}', hidden: ['label'], errors: {} } });
    await flush();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('FrameView', () => {
  it('records where its frame says it stands, and fires scroll on its host', async () => {
    const { frame, container } = await mountCopy(null);
    const host = container.querySelector<HTMLElement>('.fg-frame-host')!;
    const scrolled = vi.fn();
    host.addEventListener('scroll', scrolled);
    frame.send({ type: 'scroll', left: 3, top: 250 });
    await flush();
    expect(scrollOf(host)).toEqual({ left: 3, top: 250 });
    expect(scrolled).toHaveBeenCalledTimes(1);
  });
});
