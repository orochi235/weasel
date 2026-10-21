import { type LensSourceHandle, type LensSourceRequest, unavailableText } from '@weasel-js/labkit/loupe';
import { stableStringify } from '../../protocol/messages';
import type { CapturePayload } from '../../vite/capture/payload';
import { messageOf } from './captureClient';
import type { ForgeComparison } from './conditions';
import { NOTHING_UNDER } from './liveSource';
import { type TrialHit, trialAt } from './trialAt';

/** How long the reticle has to rest over a new story, or the story to stay unedited, before it is captured again. */
export const RECAPTURE_DEBOUNCE_MS = 250;

type Request = LensSourceRequest<ForgeComparison>;
export type PayloadFor = (hit: TrialHit, dpr: number, c: ForgeComparison | null) => CapturePayload | { unavailable: string };

/** One lens side's last image: what it was captured from, and at which revision. */
export interface Shot {
  key: string;
  revision: number;
  bitmap: ImageBitmap;
  payload: CapturePayload;
}

/** What every Pixels lens shares: where captures come from, and the last image of each lens side. */
export interface PixelsShared {
  take(payload: CapturePayload): Promise<ImageBitmap | null>;
  payloadFor: PayloadFor;
  revision(): number;
  /** By `sideOf`. */
  shots: Map<string, Shot>;
}

/** One lens side: its lens, its DPR, and whether it shows the comparison or the story as it is. */
export const sideOf = (r: Request): string => `${r.lensId}:${r.dpr}${r.conditions === null ? '' : ':compared'}`;

/** What a lens aims at: the payload it sends for the trial under its reticle, keyed by its content, or why none. */
export type Aimed = { hit: TrialHit; payload: CapturePayload; key: string } | { reason: string };

export function aim(shared: PixelsShared, request: Request, doc: Document): Aimed {
  const hit = trialAt(request.reticle, doc);
  if (!hit) return { reason: NOTHING_UNDER };
  const payload = shared.payloadFor(hit, request.dpr, request.conditions);
  if ('unavailable' in payload) return { reason: unavailableText('pixels', payload.unavailable) };
  return { hit, payload, key: stableStringify(payload) };
}

/** Whether `shot` is a capture of `key` taken since the last story edit. */
export const fresh = (shared: PixelsShared, shot: Shot | undefined, key: string): shot is Shot =>
  shot?.key === key && shot.revision === shared.revision();

/** Draws `shot` into `canvas`, `factor` times its CSS size about `at`, in host px, with every pixel kept square. */
function paint(canvas: HTMLCanvasElement, shot: Shot, at: TrialHit['local'], request: Request) {
  const sd = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  const width = Math.max(1, Math.round(request.size.width * sd));
  const height = Math.max(1, Math.round(request.size.height * sd));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  // Canvas px per PNG px: the PNG holds `dpr` of them per host px, and the lens shows a host px `factor` CSS px wide.
  const scale = (request.factor * sd) / shot.payload.dpr;
  const x = Math.round(width / 2 - at.x * request.factor * sd);
  const y = Math.round(height / 2 - at.y * request.factor * sd);
  ctx.drawImage(shot.bitmap, x, y, shot.bitmap.width * scale, shot.bitmap.height * scale);
  canvas.toggleAttribute('data-shown', true);
}

function blank(canvas: HTMLCanvasElement) {
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.toggleAttribute('data-shown', false);
}

/** An attached Pixels lens side, which its source tells to look again and to drop what it shows. */
export interface PixelsLens extends LensSourceHandle<ForgeComparison> {
  measure(): void;
  revised(): void;
}

/**
 * Attaches one lens side: a canvas showing the side's last capture, cropped about the reticle, and asking for a new
 * one when what lies under the reticle changes — at once the first time, after `RECAPTURE_DEBOUNCE_MS` at rest after
 * that. The last image stays up until the new one arrives, and a capture that started before a story edit is dropped.
 */
export function attachPixelsLens(slot: HTMLElement, first: Request, shared: PixelsShared, onDetach: () => void): PixelsLens {
  const doc = slot.ownerDocument;
  const canvas = doc.createElement('canvas');
  canvas.className = 'fg-lens-pixels';
  const empty = doc.createElement('div');
  empty.className = 'fg-lens-empty';
  empty.hidden = true;
  slot.append(canvas, empty);
  let request = first;
  let wanted: { key: string; payload: CapturePayload } | null = null;
  let pending: object | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let started = false;
  let gone = false;
  const say = (text: string | null) => {
    empty.hidden = text === null;
    empty.textContent = text ?? '';
  };
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const run = async () => {
    const target = wanted;
    if (!target) return;
    const token = {};
    pending = token;
    const at = shared.revision();
    const side = sideOf(request);
    try {
      const bitmap = await shared.take(target.payload);
      if (gone || pending !== token || bitmap === null || shared.revision() !== at) return;
      shared.shots.set(side, { key: target.key, revision: at, bitmap, payload: target.payload });
      measure();
    } catch (err) {
      if (!gone && pending === token) say(`Capture failed: ${messageOf(err)}`);
    } finally {
      if (pending === token) pending = null;
    }
  };
  const schedule = () => {
    cancel();
    if (!started) {
      started = true;
      void run();
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, RECAPTURE_DEBOUNCE_MS);
  };
  const measure = () => {
    const aimed = aim(shared, request, doc);
    if ('reason' in aimed) {
      wanted = null;
      cancel();
      blank(canvas);
      say(aimed.reason);
      return;
    }
    const { hit, payload, key } = aimed;
    const shot = shared.shots.get(sideOf(request));
    if (fresh(shared, shot, key)) {
      wanted = { key, payload };
      cancel();
      say(null);
      paint(canvas, shot, hit.local, request);
      return;
    }
    // The last image stays up, and nothing is said over it, until the new one arrives.
    say(null);
    if (wanted?.key === key && pending !== null) return;
    wanted = { key, payload };
    schedule();
  };
  measure();
  return {
    measure,
    revised() {
      pending = null;
      wanted = null;
      blank(canvas);
      measure();
    },
    update(next) {
      request = next;
      measure();
    },
    detach() {
      gone = true;
      cancel();
      shared.shots.delete(sideOf(request));
      canvas.remove();
      empty.remove();
      onDetach();
    },
  };
}
