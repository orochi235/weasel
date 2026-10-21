import './loupe.css';
import type { LensCapture, LensSource } from '@weasel-js/labkit/loupe';
import { createCaptureClient } from './captureClient';
import type { ForgeComparison } from './conditions';
import { aim, attachPixelsLens, fresh, type PayloadFor, type PixelsLens, type PixelsShared, type Shot, sideOf } from './pixelsLens';

export { CHECKING } from './captureClient';
export { RECAPTURE_DEBOUNCE_MS } from './pixelsLens';

/** The Pixels source, plus a way for its host to have every attached lens look again at what lies under it. */
export interface PixelsSource extends LensSource<ForgeComparison> {
  remeasure(): void;
}

export interface PixelsSourceOptions {
  /** The dev server's base, under which its capture endpoint answers. */
  base: string;
  payloadFor: PayloadFor;
  fetch?: typeof fetch;
  /** The story edits so far; a capture taken at an older count is never shown. */
  revision: () => number;
  subscribeRevision: (fn: () => void) => () => void;
}

/**
 * A lens showing a real capture of the story under its reticle, taken by the dev server in headless Chromium at the
 * lens side's DPR and enlarged nearest-neighbor. Each lens side keeps its last image until a newer one arrives; an
 * edit to any story drops every one of them.
 */
export function createPixelsSource(opts: PixelsSourceOptions): PixelsSource {
  const client = createCaptureClient(opts.base, opts.fetch ?? ((input, init) => globalThis.fetch(input, init)));
  const shared: PixelsShared = { take: client.take, payloadFor: opts.payloadFor, revision: opts.revision, shots: new Map<string, Shot>() };
  const lenses = new Set<PixelsLens>();
  let unrevise: (() => void) | null = null;
  const revised = () => {
    shared.shots.clear();
    for (const lens of [...lenses]) lens.revised();
  };

  return {
    kind: 'pixels',
    produces: 'pixels',
    label: (request) => `Pixels ${request.dpr}×`,
    status: client.status,
    subscribe: client.subscribe,
    attach(slot, first) {
      client.poll();
      unrevise ??= opts.subscribeRevision(revised);
      const lens = attachPixelsLens(slot, first, shared, () => {
        lenses.delete(lens);
        if (lenses.size > 0) return;
        unrevise?.();
        unrevise = null;
      });
      lenses.add(lens);
      return lens;
    },
    async capture(request): Promise<LensCapture | null> {
      const aimed = aim(shared, request, document);
      if ('reason' in aimed) return null;
      const side = sideOf(request);
      let shot = shared.shots.get(side);
      if (!fresh(shared, shot, aimed.key)) {
        const at = opts.revision();
        const bitmap = await client.take(aimed.payload);
        if (bitmap === null || opts.revision() !== at) return null;
        shot = { key: aimed.key, revision: at, bitmap, payload: aimed.payload };
        shared.shots.set(side, shot);
      }
      return { bitmap: shot.bitmap, dpr: aimed.payload.dpr, box: aimed.payload.box, at: aimed.hit.local };
    },
    remeasure() {
      for (const lens of [...lenses]) lens.measure();
    },
  };
}
