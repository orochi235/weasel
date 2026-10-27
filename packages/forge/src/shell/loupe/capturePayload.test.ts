import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePayload, type CapturePayloadInput, CONFIG_UNSENDABLE, STATE_UNSENDABLE, trialPayload } from './capturePayload';
import type { TrialInputs } from './captureContext';
import { reportFrameScroll } from './frameScroll';
import type { TrialHit } from './trialAt';

/** A host whose box jsdom, having no layout, would otherwise report as 0 × 0. */
function host(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width });
  Object.defineProperty(el, 'offsetHeight', { value: height });
  return el;
}

const input: CapturePayloadInput = {
  entry: { id: 'ui-a--b' },
  layout: 'padded',
  config: { label: 'Go', size: 'm', $playhead: 120, $globals: { mode: 'dark' } },
  state: { count: 1, items: ['x', { done: false }] },
  globals: { mode: 'dark', theme: 'paper' },
  overrides: { '--wzl-accent': 'tomato' },
  host: host(320, 180),
  dpr: 2,
  resolved: { globals: { mode: 'light', theme: 'paper' }, args: { label: 'Stop' }, dpr: null },
  lab: { globals: { mode: 'light', theme: 'paper' }, mode: 'light' },
  colorScheme: 'light',
  playhead: 120,
};

describe('capturePayload', () => {
  it('refuses a story whose state is a Map, naming why', () => {
    expect(capturePayload({ ...input, state: new Map([[1, 2]]) })).toEqual({ unavailable: STATE_UNSENDABLE });
    expect(STATE_UNSENDABLE).toBe("this story's state cannot be sent to a capture");
    // Anything JSON would change on the way, not only a top-level Map.
    expect(capturePayload({ ...input, state: { at: new Date(0) } })).toEqual({ unavailable: STATE_UNSENDABLE });
    expect(capturePayload({ ...input, state: { n: Number.NaN } })).toEqual({ unavailable: STATE_UNSENDABLE });
    expect(capturePayload({ ...input, state: { gone: undefined } })).toEqual({ unavailable: STATE_UNSENDABLE });
    expect(capturePayload({ ...input, state: { big: 1n } })).toEqual({ unavailable: STATE_UNSENDABLE });
    // JSON writes a hole as null.
    expect(capturePayload({ ...input, state: { items: [1, , 3] } })).toEqual({ unavailable: STATE_UNSENDABLE });
  });

  it('refuses a config, or a comparison arg, that JSON would change', () => {
    expect(capturePayload({ ...input, config: { at: new Date(0) } })).toEqual({ unavailable: CONFIG_UNSENDABLE });
    expect(capturePayload({ ...input, resolved: { ...input.resolved, args: { tags: new Set(['a']) } } })).toEqual({
      unavailable: CONFIG_UNSENDABLE,
    });
    expect(CONFIG_UNSENDABLE).toBe("this story's config cannot be sent to a capture");
  });

  it('sends a config whose unset args are undefined, without them', () => {
    // Every argType with no default is in the config as undefined, which a story reads as it reads a missing arg.
    const got = capturePayload({ ...input, config: { label: 'Stop', href: undefined, nested: { a: 1, b: undefined } } });
    expect(got).toMatchObject({ config: { label: 'Stop', nested: { a: 1 } } });
    expect(Object.keys((got as { config: object }).config)).toEqual(['label', 'nested']);
  });

  it("reads where the story's scroller stands in its host", () => {
    const scrolled = host(320, 180);
    const scroller = document.createElement('div');
    scroller.className = 'fg-story__scroll';
    // jsdom lays nothing out, so it keeps no scroll position of its own.
    Object.defineProperty(scroller, 'scrollLeft', { value: 12 });
    Object.defineProperty(scroller, 'scrollTop', { value: 340 });
    scrolled.append(scroller);
    expect(capturePayload({ ...input, host: scrolled })).toMatchObject({ scroll: { left: 12, top: 340 } });
  });

  it("reads where an isolated story's frame last said it stood", () => {
    const frameHost = host(320, 180);
    frameHost.dataset.fgHost = 't-isolated';
    reportFrameScroll(frameHost, { left: 8, top: 520 });
    const isolated = { ...input, entry: { id: 'ui-a--b', isolate: 'needs a document of its own' }, host: frameHost };
    expect(capturePayload(isolated)).toMatchObject({ scroll: { left: 8, top: 520 } });
  });

  it('carries args, globals, state, the playhead and the vars overrides', () => {
    expect(capturePayload(input)).toEqual({
      story: 'ui-a--b',
      isolate: false,
      config: { label: 'Stop', size: 'm' },
      state: { count: 1, items: ['x', { done: false }] },
      globals: { mode: 'dark', theme: 'paper' },
      overrides: { '--wzl-accent': 'tomato' },
      playhead: 120,
      box: { width: 320, height: 180 },
      layout: 'padded',
      dpr: 2,
      scroll: { left: 0, top: 0 },
      lab: { globals: { mode: 'light', theme: 'paper' }, mode: 'light' },
      colorScheme: 'light',
    });
    expect(capturePayload({ ...input, playhead: null })).toMatchObject({ playhead: null });
  });

  it('sends no playhead for an isolated story', () => {
    const payload = capturePayload({ ...input, entry: { id: 'ui-a--b', isolate: 'needs a document of its own' } });
    expect(payload).toMatchObject({ isolate: true, playhead: null, config: { label: 'Stop', size: 'm' } });
  });
});

describe('trialPayload', () => {
  const trial: TrialInputs = {
    entry: { id: 'ui-a--b' },
    layout: 'padded',
    config: { label: 'Go', $globals: { theme: 'paper', density: 'lab' } },
    state: null,
    overrides: {},
    playhead: () => 1500,
  };
  const hit = (): TrialHit => ({ trialId: 't1', host: host(100, 50), local: { x: 10, y: 10 }, scale: 1 });
  const lab = {
    labValues: { mode: 'light', theme: 'chrome', density: 'compact' },
    mode: 'auto' as const,
    declarations: {},
    modeGlobal: 'mode',
  };
  const prefersDark = (dark: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query === '(prefers-color-scheme: dark)' }));

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the trial's playhead when the capture is taken", () => {
    let at: number | null = 1500;
    const moving = { ...trial, playhead: () => at };
    expect(trialPayload(moving, lab, hit(), 1, null)).toMatchObject({ playhead: 1500 });
    at = null;
    expect(trialPayload(moving, lab, hit(), 1, null)).toMatchObject({ playhead: null });
  });

  it("renders under the trial's pins, and the lab's values for the rest", () => {
    prefersDark(false);
    expect(trialPayload(trial, lab, hit(), 1, null)).toMatchObject({
      globals: { mode: 'light', theme: 'paper', density: 'compact' },
      lab: { globals: lab.labValues, mode: 'light' },
    });
  });

  it('takes the comparison’s value for each global it sets, a pin included, and its args', () => {
    prefersDark(false);
    const c = { kind: 'custom' as const, globals: { theme: 'ink' }, args: { label: 'Stop' } };
    expect(trialPayload(trial, lab, hit(), 2, c)).toMatchObject({
      globals: { mode: 'light', theme: 'ink', density: 'compact' },
      config: { label: 'Stop' },
      dpr: 2,
    });
  });

  it('flips the trial’s own mode in opposite mode: a trial pinned light under a dark lab captures dark', () => {
    prefersDark(false);
    const pinned = { ...trial, config: { ...(trial.config as object), $globals: { mode: 'light' } } };
    const dark = { ...lab, labValues: { ...lab.labValues, mode: 'dark' } };
    expect(trialPayload(pinned, dark, hit(), 1, { kind: 'opposite-mode' })).toMatchObject({ globals: { mode: 'dark' } });
  });

  it('captures at a DPR comparison’s own DPR', () => {
    prefersDark(false);
    expect(trialPayload(trial, lab, hit(), 1, { kind: 'custom', dpr: 3 })).toMatchObject({ dpr: 3 });
  });

  it("resolves the lab's auto mode through the OS color scheme", () => {
    prefersDark(true);
    expect(trialPayload(trial, lab, hit(), 1, null)).toMatchObject({ lab: { mode: 'dark' } });
    prefersDark(false);
    expect(trialPayload(trial, lab, hit(), 1, null)).toMatchObject({ lab: { mode: 'light' } });
    expect(trialPayload(trial, { ...lab, mode: 'dark' }, hit(), 1, null)).toMatchObject({ lab: { mode: 'dark' } });
  });

  it('carries the OS color scheme, whatever mode the lab is in, for the capture page to emulate', () => {
    prefersDark(true);
    expect(trialPayload(trial, { ...lab, mode: 'light' }, hit(), 1, null)).toMatchObject({ colorScheme: 'dark' });
    prefersDark(false);
    expect(trialPayload(trial, { ...lab, mode: 'dark' }, hit(), 1, null)).toMatchObject({ colorScheme: 'light' });
  });

  it('says a trial that published nothing shows no story', () => {
    expect(trialPayload(null, lab, hit(), 1, null)).toEqual({ unavailable: 'this trial shows no story to capture' });
  });
});
