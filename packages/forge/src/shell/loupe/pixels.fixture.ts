import type { LensSourceRequest } from '@weasel-js/labkit/loupe';
import { vi } from 'vitest';
import type { CapturePayload } from '../../vite/capture/payload';
import type { ForgeComparison } from './conditions';

// jsdom has no layout, no hit testing and no image decoding: `elementsFromPoint` answers from the hosts' stated client
// rects, and a decoded image is a stand-in carrying the bytes it came from. Whether the canvas shows an image is read
// from its `data-shown` attribute, a proxy for its pixels, which the browser test reads for real.

export interface Bitmap {
  width: number;
  height: number;
  from: string;
}

/** Lets every answer already given run its course: none of them waits on a timer. */
export async function settle() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

export const payload = (story: string): CapturePayload => ({
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
  scroll: { left: 0, top: 0 },
  lab: { globals: {}, mode: 'light' },
});

/** Two trial hosts side by side, each 100 px wide, found by the x of a client point. */
export function hosts() {
  const a = document.createElement('div');
  a.dataset.fgHost = 'trial-a';
  const b = document.createElement('div');
  b.dataset.fgHost = 'trial-b';
  document.body.append(a, b);
  for (const [el, left] of [[a, 0], [b, 100]] as const) {
    el.getBoundingClientRect = () => ({ left, top: 0, width: 100, height: 100, right: left + 100, bottom: 100, x: left, y: 0, toJSON: () => ({}) });
    Object.defineProperty(el, 'offsetWidth', { value: 100 });
    Object.defineProperty(el, 'offsetHeight', { value: 100 });
  }
  document.elementsFromPoint = (x: number) => (x < 100 ? [a] : x < 200 ? [b] : []);
  return { a, b };
}

/** A capture endpoint: GET says it is available, each POST is held until the test lets it answer. */
export function endpoint() {
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

export function revisions() {
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

export const request = (x: number): LensSourceRequest<ForgeComparison> => ({
  lensId: 'lens-0',
  reticle: { x, y: 50 },
  factor: 4,
  size: { width: 160, height: 160 },
  conditions: null,
  dpr: 1,
});

export const shown = (slot: HTMLElement) => slot.querySelector('canvas')?.hasAttribute('data-shown') ?? false;

/** Decodes a fake capture to a stand-in bitmap naming it; undo with `vi.unstubAllGlobals()`. */
export function stubBitmaps() {
  vi.stubGlobal('createImageBitmap', async (blob: { label: string }) => ({ width: 100, height: 100, from: blob.label }) satisfies Bitmap);
}
