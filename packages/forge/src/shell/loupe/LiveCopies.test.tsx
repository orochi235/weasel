import { LabContext, type LabContextValue, type RenderContext, TrialIdContext } from '@weasel-js/labkit';
import { f } from '@weasel-js/labkit/config';
import type { LensSourceHandle, LensSourceRequest } from '@weasel-js/labkit/loupe';
import { act, fireEvent, within } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { describeSchema } from '../../protocol/schema';
import { meta, story } from '../../story/define';
import { loadNativeModule } from '../../story/native';
import { createAnswerBook } from '../answers';
import { FrameView } from '../FrameView';
import { type IndexBundle, IndexTrial } from '../IndexTrial';
import { connectFrame, flush, installResizeObserver } from '../labHarness';
import { type Ready, readyKey } from '../readyKey';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { StoryTrial } from '../StoryTrial';
import { type ForgeComparison, resolveComparison } from './conditions';
import { createLiveLenses, type LiveLenses, LiveLensesContext } from './liveLenses';
import { createLiveSource, NOTHING_UNDER } from './liveSource';

installResizeObserver();

const [counter] = loadNativeModule(
  {
    default: meta({ title: 'Test/Live' }),
    Live: story({
      config: f.schema({ label: f.string('A'), size: f.number(1) }),
      render: ({ config, state, setConfig, globals }) => (
        <>
          <output data-testid="mode">{String(globals.mode)}</output>
          <output data-testid="label">{config.label}</output>
          <output data-testid="size">{config.size}</output>
          <output data-testid="count">{String((state as unknown as { count: number }).count)}</output>
          <button type="button" onClick={() => setConfig('label', 'x')}>
            relabel
          </button>
          <button type="button" onClick={() => setConfig('size', 3)}>
            resize
          </button>
        </>
      ),
    }),
  },
  'Test/Live',
);

let lenses: LiveLenses;
let slot: HTMLElement;
let closeTrial: () => void;

function Harness({ lab = 'light', pin }: { lab?: string; pin?: string }) {
  const [config, setConfigState] = useState<Record<string, unknown>>({
    label: 'A',
    size: 1,
    ...(pin ? { $globals: { mode: pin } } : {}),
  });
  const [open, setOpen] = useState(true);
  closeTrial = () => setOpen(false);
  return (
    <LiveLensesContext.Provider value={lenses}>
      <StoryGlobalsContext.Provider value={{ mode: lab }}>
        <TrialIdContext.Provider value="t1">
          {open ? (
            <StoryTrial
              story={counter!}
              setup={{}}
              ctx={{
                config,
                state: { count: 5 },
                setConfig: (path, value) => setConfigState((prev) => ({ ...prev, [path]: value })),
                setState: () => {},
              }}
            />
          ) : null}
        </TrialIdContext.Provider>
      </StoryGlobalsContext.Provider>
    </LiveLensesContext.Provider>
  );
}

const mainHost = () => document.querySelector<HTMLElement>('[data-fg-host="t1"]')!;
const main = () => within(mainHost());
const inSlot = () => within(slot);

const DARK_B: ForgeComparison = { kind: 'custom', globals: { mode: 'dark' }, args: { label: 'B' } };

function request(
  reticle: { x: number; y: number },
  conditions: ForgeComparison | null = DARK_B,
): LensSourceRequest<ForgeComparison> {
  return { lensId: 'a', reticle, factor: 4, size: { width: 160, height: 160 }, conditions, dpr: 1 };
}

/** The Live source attached to `slot`, as a lens slot would attach it. */
function attach(
  at: { x: number; y: number },
  opts: { lab?: string; compare?: ForgeComparison } = {},
): LensSourceHandle<ForgeComparison> & { remeasure(): void } {
  const source = createLiveSource(lenses, resolveComparison, () => ({
    base: { mode: opts.lab ?? 'light' },
    ctx: { declarations: {}, modeGlobal: 'mode', prefersDark: false, labMode: 'light' },
  }));
  let handle!: LensSourceHandle<ForgeComparison>;
  act(() => {
    handle = source.attach(slot, request(at, opts.compare));
  });
  return { ...handle, remeasure: () => act(() => source.remeasure()) };
}

// jsdom does no hit-testing: the trial's host answers for every point left of x = 500, as a browser would report a
// host covering that half, and nothing answers to the right of it.
beforeEach(() => {
  lenses = createLiveLenses();
  slot = document.body.appendChild(document.createElement('div'));
  document.elementsFromPoint = (x: number) => {
    const host = document.querySelector('[data-fg-host="t1"]');
    return x < 500 && host ? [host, document.body] : [document.body];
  };
});

afterEach(() => {
  slot.remove();
});

describe('LiveCopies', () => {
  it('renders a copy with the comparison’s globals and args, reading the trial’s state', async () => {
    renderWithIcons(<Harness />);
    await main().findByTestId('mode');
    attach({ x: 100, y: 100 });
    expect((await inSlot().findByTestId('mode')).textContent).toBe('dark');
    expect(inSlot().getByTestId('label').textContent).toBe('B');
    expect(inSlot().getByTestId('count').textContent).toBe('5');
    expect(slot.querySelector('[data-fg-host="t1~lens-a~compared"]')?.hasAttribute('data-fg-copy')).toBe(true);
    expect(main().getByTestId('mode').textContent).toBe('light');
    expect(main().getByTestId('label').textContent).toBe('A');
  });

  it('drops a copy’s write to an arg the comparison overrides, and passes others to the trial', async () => {
    renderWithIcons(<Harness />);
    await main().findByTestId('mode');
    attach({ x: 100, y: 100 });
    fireEvent.click(await inSlot().findByRole('button', { name: 'relabel' }));
    expect(main().getByTestId('label').textContent).toBe('A');
    fireEvent.click(inSlot().getByRole('button', { name: 'resize' }));
    expect(main().getByTestId('size').textContent).toBe('3');
    expect(inSlot().getByTestId('size').textContent).toBe('3');
  });

  it('unmounts the copy and says so when the reticle leaves every trial', async () => {
    renderWithIcons(<Harness />);
    await main().findByTestId('mode');
    const handle = attach({ x: 100, y: 100 });
    await inSlot().findByTestId('mode');
    act(() => handle.update(request({ x: 700, y: 100 })));
    expect(slot.querySelector('[data-fg-copy]')).toBeNull();
    expect(lenses.forTrial('t1')).toEqual([]);
    const empty = slot.querySelector<HTMLElement>('.fg-lens-empty')!;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toBe(NOTHING_UNDER);
  });

  it('unmounts the copy, with no throw, when its trial closes under a lens', async () => {
    renderWithIcons(<Harness />);
    await main().findByTestId('mode');
    const handle = attach({ x: 100, y: 100 });
    await inSlot().findByTestId('mode');
    act(() => closeTrial());
    expect(slot.querySelector('[data-fg-copy]')).toBeNull();
    // What the workshop's loupe does when the lab's trials change.
    expect(() => handle.remeasure()).not.toThrow();
    expect(lenses.forTrial('t1')).toEqual([]);
    expect(slot.textContent).toBe(NOTHING_UNDER);
  });

  it('gives a lens over an isolated story a frame of its own, under the comparison’s globals and args', async () => {
    const ready: Ready = { type: 'ready', schema: describeSchema(f.schema({ label: f.string('A') })), layout: 'centered', viewport: null };
    const entry = { id: 'test-live--live', title: 'Test/Live', name: 'Live', exportName: 'Live', file: '/x.stories.tsx' };
    const trial = { config: { label: 'A' }, state: null, setConfig: () => {}, setState: () => {} } as unknown as RenderContext<unknown, unknown>;
    renderWithIcons(
      <LabContext.Provider value={{ instruments: [] } as unknown as LabContextValue}>
        <LiveLensesContext.Provider value={lenses}>
          <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
            <TrialIdContext.Provider value="t1">
              <FrameView entry={entry} frameUrl="/frame.html" answers={createAnswerBook()} onReady={() => {}} descriptionKey={readyKey(ready)} ctx={trial} />
            </TrialIdContext.Provider>
          </StoryGlobalsContext.Provider>
        </LiveLensesContext.Provider>
      </LabContext.Provider>,
    );
    attach({ x: 100, y: 100 });
    const copy = slot.querySelector<HTMLElement>('.fg-frame-host[data-fg-host="t1~lens-a~compared"]');
    expect(copy?.hasAttribute('data-fg-copy')).toBe(true);
    expect(slot.querySelector<HTMLElement>('.fg-lens-empty')!.hidden).toBe(true);
    const { frame, received } = connectFrame(copy!.querySelector('iframe') as HTMLIFrameElement);
    frame.send(ready);
    await flush();
    expect(received[0]).toEqual({ type: 'init', config: { label: 'B' }, state: null, globals: { mode: 'dark' } });
    frame.close();
  });

  it('shows the mode a comparison asks for even where the lab already has it and the trial pins another', async () => {
    renderWithIcons(<Harness lab="dark" pin="light" />);
    expect((await main().findByTestId('mode')).textContent).toBe('light');
    attach({ x: 100, y: 100 }, { lab: 'dark', compare: { kind: 'custom', globals: { mode: 'dark' } } });
    expect((await inSlot().findByTestId('mode')).textContent).toBe('dark');
  });

  it('flips a trial’s own pin in opposite mode, so a trial pinned light under a dark lab shows dark', async () => {
    renderWithIcons(<Harness lab="dark" pin="light" />);
    expect((await main().findByTestId('mode')).textContent).toBe('light');
    attach({ x: 100, y: 100 }, { lab: 'dark', compare: { kind: 'opposite-mode' } });
    expect((await inSlot().findByTestId('mode')).textContent).toBe('dark');
  });

  it('renders a Split lens’s two cells as two copies: the story as it is, and the compared one', async () => {
    renderWithIcons(<Harness />);
    await main().findByTestId('mode');
    const compared = attach({ x: 100, y: 100 }, { compare: { kind: 'opposite-mode' } });
    const other = slot;
    slot = document.body.appendChild(document.createElement('div'));
    const source = createLiveSource(lenses, resolveComparison, () => ({
      base: { mode: 'light' },
      ctx: { declarations: {}, modeGlobal: 'mode', prefersDark: false, labMode: 'light' },
    }));
    act(() => void source.attach(slot, request({ x: 100, y: 100 }, null)));
    expect((await inSlot().findByTestId('mode')).textContent).toBe('light');
    expect((await within(other).findByTestId('mode')).textContent).toBe('dark');
    expect(lenses.forTrial('t1').map((r) => r.lensId).sort()).toEqual(['a', 'a~compared']);
    act(() => compared.detach());
    other.remove();
  });

  it('renders a copy of a component’s index page, under the comparison’s globals', async () => {
    const bundle: IndexBundle = {
      title: 'Test/Live',
      library: 'test',
      galleries: [],
      stories: [],
      descriptions: {},
      render: ({ globals }) => <output data-testid="index-mode">{String(globals.mode)}</output>,
    };
    renderWithIcons(
      <LabContext.Provider value={{ instruments: [] } as unknown as LabContextValue}>
        <LiveLensesContext.Provider value={lenses}>
          <StoryGlobalsContext.Provider value={{ mode: 'light' }}>
            <TrialIdContext.Provider value="t1">
              <IndexTrial bundle={bundle} setup={{}} config={{}} />
            </TrialIdContext.Provider>
          </StoryGlobalsContext.Provider>
        </LiveLensesContext.Provider>
      </LabContext.Provider>,
    );
    expect((await main().findByTestId('index-mode')).textContent).toBe('light');
    attach({ x: 100, y: 100 });
    expect((await inSlot().findByTestId('index-mode')).textContent).toBe('dark');
    expect(slot.querySelector('[data-fg-host="t1~lens-a~compared"]')?.hasAttribute('data-fg-copy')).toBe(true);
  });

  it('keeps a trial’s pin on a global the comparison leaves alone', async () => {
    renderWithIcons(<Harness lab="dark" pin="light" />);
    await main().findByTestId('mode');
    attach({ x: 100, y: 100 }, { lab: 'dark', compare: { kind: 'custom', args: { label: 'B' } } });
    expect((await inSlot().findByTestId('label')).textContent).toBe('B');
    expect(inSlot().getByTestId('mode').textContent).toBe('light');
  });
});
