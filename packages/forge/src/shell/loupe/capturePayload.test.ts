import { describe, expect, it } from 'vitest';
import { capturePayload, type CapturePayloadInput, STATE_UNSENDABLE } from './capturePayload';

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
      lab: { globals: { mode: 'light', theme: 'paper' }, mode: 'light' },
    });
    expect(capturePayload({ ...input, config: { label: 'Go' } })).toMatchObject({ playhead: null });
  });

  it('sends no playhead for an isolated story', () => {
    const payload = capturePayload({ ...input, entry: { id: 'ui-a--b', isolate: 'needs a document of its own' } });
    expect(payload).toMatchObject({ isolate: true, playhead: null, config: { label: 'Stop', size: 'm' } });
  });
});
