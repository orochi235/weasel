import type { LensSourceRequest } from '@weasel-js/labkit/loupe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturePayload } from '../../vite/capture/payload';
import type { ForgeComparison } from './conditions';
import { createPixelsSource, RECAPTURE_DEBOUNCE_MS } from './pixelsSource';
import type { TrialHit } from './trialAt';

// jsdom has no layout, no hit testing and no image decoding: `elementsFromPoint` answers from the hosts' stated client
// rects, and a decoded image is a stand-in carrying the bytes it came from. Whether the canvas shows an image is read
// from its `data-shown` attribute, a proxy for its pixels, which the browser test reads for real.

interface Bitmap {
  width: number;
  height: number;
  from: string;
}

/** Lets every answer already given run its course: none of them waits on a timer. */
async function settle() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

const payload = (story: string): CapturePayload => ({
  story,
  isolate: false,
  config: {},
  state: null,
  globals: {},
  overrides: {},
  playhead: null,
  box: { width: 100, height: 100 },
  layout: 'padded',
  dpr: 1,
  lab: { globals: {}, mode: 'light' },
});

/** Two trial hosts side by side, each 100 px wide, found by the x of a client point. */
function hosts() {
  const a = document.createElement('div');
  a.dataset.fgHost = 'trial-a';
  const b = document.createElement('div');
  b.dataset.fgHost = 'trial-b';
  document.body.append(a, b);
  for (const [el, left] of [[a, 0], [b, 100]] as const) {
    el.getBoundingClientRect = () => ({ left, top: 0, width: 100, height: 100, right: left + 100, bottom: 100, x: left, y: 0, toJSON: () => ({}) });
    Object.defineProperty(el, 'offsetWidth', { value: 100 });
  }
  document.elementsFromPoint = (x: number) => (x < 100 ? [a] : x < 200 ? [b] : []);
  return { a, b };
}

/** A capture endpoint: GET says it is available, each POST is held until the test lets it answer. */
function endpoint() {
  const posts: { body: CapturePayload; answer: () => void }[] = [];
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init || init.method !== 'POST') return { ok: true, status: 200, json: async () => ({ available: true }) } as Response;
    const body = JSON.parse(String(init.body)) as CapturePayload;
    const n = posts.length + 1;
    return new Promise<Response>((resolve) => {
      posts.push({
        body,
        answer: () => resolve({ ok: true, status: 200, blob: async () => ({ label: `png ${body.story} #${n}` }) } as unknown as Response),
      });
    });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, posts };
}

function revisions() {
  let n = 0;
  const listeners = new Set<() => void>();
  return {
    revision: () => n,
    subscribeRevision: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    bump() {
      n += 1;
      for (const fn of [...listeners]) fn();
    },
  };
}

const request = (x: number): LensSourceRequest<ForgeComparison> => ({
  lensId: 'lens-0',
  reticle: { x, y: 50 },
  factor: 4,
  size: { width: 160, height: 160 },
  conditions: null,
  dpr: 1,
});

const payloadFor = (hit: TrialHit) => payload(`story-of-${hit.trialId}`);

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', async (blob: { label: string }) => ({ width: 100, height: 100, from: blob.label }) satisfies Bitmap);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const shown = (slot: HTMLElement) => slot.querySelector('canvas')?.hasAttribute('data-shown') ?? false;

describe('createPixelsSource', () => {
  it('debounces recapture to 250 ms while the reticle moves', async () => {
    vi.useFakeTimers();
    hosts();
    const { fetch, posts } = endpoint();
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...revisions() });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    await vi.advanceTimersByTimeAsync(0);
    // The first capture goes at once.
    expect(posts.map((p) => p.body.story)).toEqual(['story-of-trial-a']);
    expect(fetch).toHaveBeenCalledWith('/__forge/capture', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }));
    posts[0]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);

    // Moving within the trial changes only where the image is cropped: nothing to capture again.
    handle.update(request(60));
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS * 2);
    expect(posts).toHaveLength(1);

    // Crossing to the other trial and wandering there waits for the reticle to settle.
    handle.update(request(150));
    await vi.advanceTimersByTimeAsync(100);
    handle.update(request(160));
    await vi.advanceTimersByTimeAsync(100);
    handle.update(request(170));
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS - 1);
    expect(posts).toHaveLength(1);
    // The last image stays up meanwhile.
    expect(shown(slot)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(posts.map((p) => p.body.story)).toEqual(['story-of-trial-a', 'story-of-trial-b']);
    handle.detach();
  });

  it('drops its last image on a revision bump', async () => {
    vi.useFakeTimers();
    hosts();
    const { fetch, posts } = endpoint();
    const rev = revisions();
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...rev });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    await vi.advanceTimersByTimeAsync(0);
    posts[0]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);
    const before = await source.capture!(request(50));
    expect((before?.bitmap as unknown as Bitmap).from).toBe('png story-of-trial-a #1');
    expect(posts).toHaveLength(1);

    rev.bump();
    expect(shown(slot)).toBe(false);
    // The same payload is captured again rather than served from the lens's own copy.
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS);
    expect(posts).toHaveLength(2);
    expect(posts[1]!.body).toEqual(posts[0]!.body);
    posts[1]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);
    const after = await source.capture!(request(50));
    expect((after?.bitmap as unknown as Bitmap).from).toBe('png story-of-trial-a #2');
    handle.detach();
  });

  it('never shows a capture that was taken before the story was edited', async () => {
    vi.useFakeTimers();
    hosts();
    const { fetch, posts } = endpoint();
    const rev = revisions();
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...rev });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    await vi.advanceTimersByTimeAsync(0);
    expect(posts).toHaveLength(1);

    // The edit lands while the first capture is still being taken.
    rev.bump();
    posts[0]!.answer();
    await settle();
    expect(shown(slot)).toBe(false);
    await vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS);
    expect(posts).toHaveLength(2);
    posts[1]!.answer();
    await settle();
    expect(shown(slot)).toBe(true);
    const shot = await source.capture!(request(50));
    expect((shot?.bitmap as unknown as Bitmap).from).toBe('png story-of-trial-a #2');
    handle.detach();
  });

  it("says why a lens cannot show its trial, as the payload names it", async () => {
    hosts();
    const { fetch, posts } = endpoint();
    const source = createPixelsSource({
      base: '/',
      payloadFor: () => ({ unavailable: "this story's state cannot be sent to a capture" }),
      fetch,
      ...revisions(),
    });
    const slot = document.createElement('div');
    const handle = source.attach(slot, request(50));
    expect(slot.textContent).toBe("Pixels unavailable: this story's state cannot be sent to a capture");
    expect(posts).toHaveLength(0);
    expect(shown(slot)).toBe(false);
    handle.detach();
  });

  it("reports the endpoint's answer as its status, asking again on subscribe", async () => {
    const answers = [{ available: false, reason: 'install playwright' }, { available: true }];
    const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => answers.shift() }) as unknown as Response);
    const source = createPixelsSource({ base: '/base/', payloadFor, fetch, ...revisions() });
    const changed = vi.fn();
    const off = source.subscribe(changed);
    await vi.waitFor(() => expect(source.status()).toBe('install playwright'));
    off();
    source.subscribe(changed);
    await vi.waitFor(() => expect(source.status()).toBe(true));
    expect(fetch).toHaveBeenCalledWith('/base/__forge/capture');
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('says the server takes no captures where nothing answers at the endpoint, as in a built workshop', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => Promise.reject(new SyntaxError('not JSON')) }) as unknown as Response);
    const source = createPixelsSource({ base: '/', payloadFor, fetch, ...revisions() });
    source.subscribe(() => {});
    await vi.waitFor(() => expect(source.status()).toBe('this server takes no captures'));
  });
});
