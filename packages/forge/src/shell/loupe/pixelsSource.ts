import './loupe.css';
import { type LensCapture, type LensSource, unavailableText } from '@weasel-js/labkit/loupe';
import { createEmitter } from '@weasel-js/registry';
import { createCaptureClient } from './captureClient';
import type { ForgeComparison } from './conditions';
import { aim, attachPixelsLens, fresh, type PayloadFor, type PixelsLens, type PixelsShared, type Shot, sideOf } from './pixelsLens';

/** Why a capture is not given: the story was edited while it was being taken. */
export const STORY_CHANGED = 'the story changed while it was captured';

/** How many shots a source keeps for lens sides no attached lens shows, as Difference's are: two per open lens. */
export const LOOSE_SHOTS = 8;

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
  const shots = new Map<string, Shot>();
  const lenses = new Set<PixelsLens>();
  let unrevise: (() => void) | null = null;
  const remeasured = createEmitter<[]>();
  // The source owns every bitmap in `shots`: a capture it handed out is good until its side's next one, or until the
  // shot is dropped. Closed once let go of, unless another side still holds the same bitmap.
  const letGo = (shot: Shot | undefined) => {
    if (!shot) return;
    for (const held of shots.values()) if (held.bitmap === shot.bitmap) return;
    shot.bitmap.close();
  };
  const drop = (side: string) => {
    const shot = shots.get(side);
    shots.delete(side);
    letGo(shot);
  };
  // A side only `capture` writes has no detach to drop it: a stale one goes at the next write, and past
  // `LOOSE_SHOTS` the longest unwritten go.
  const keep = (side: string, shot: Shot) => {
    const replaced = shots.get(side);
    shots.delete(side);
    shots.set(side, shot);
    letGo(replaced);
    const attached = new Set([...lenses].map((l) => l.side()));
    const loose = [...shots].filter(([s]) => !attached.has(s));
    let over = loose.length - LOOSE_SHOTS;
    for (const [s, held] of loose) {
      if (s === side) continue;
      if (held.revision !== opts.revision() || over > 0) {
        drop(s);
        over -= 1;
      }
    }
  };
  const shared: PixelsShared = { take: client.take, payloadFor: opts.payloadFor, revision: opts.revision, shots, keep };
  const revised = () => {
    const bitmaps = new Set([...shots.values()].map((s) => s.bitmap));
    shots.clear();
    for (const bitmap of bitmaps) bitmap.close();
    for (const lens of [...lenses]) lens.revised();
  };

  return {
    kind: 'pixels',
    produces: 'pixels',
    // A DPR comparison captures at its own DPR, as the payload does.
    label: ({ conditions, dpr }) => `Pixels ${(conditions?.kind === 'custom' ? conditions.dpr : undefined) ?? dpr}×`,
    status: client.status,
    // Also told whenever a capture may have gone stale, for a lens that captures without attaching, as Difference does.
    subscribe(listener) {
      const offs = [client.subscribe(listener), remeasured.subscribe(listener), opts.subscribeRevision(listener)];
      return () => {
        for (const off of offs) off();
      };
    },
    attach(slot, first) {
      client.poll();
      unrevise ??= opts.subscribeRevision(revised);
      const lens = attachPixelsLens(slot, first, shared, () => {
        lenses.delete(lens);
        const side = lens.side();
        if (![...lenses].some((l) => l.side() === side)) drop(side);
        if (lenses.size > 0) return;
        unrevise?.();
        unrevise = null;
      });
      lenses.add(lens);
      return lens;
    },
    async capture(request): Promise<LensCapture | { reason: string }> {
      const aimed = aim(shared, request, document);
      if ('reason' in aimed) return { reason: aimed.reason };
      const side = sideOf(request);
      let shot = shots.get(side);
      if (!fresh(shared, shot, aimed.key)) {
        const at = opts.revision();
        const bitmap = await client.take(aimed.payload);
        if (bitmap === null) {
          const status = client.status();
          return { reason: unavailableText('pixels', status === true ? 'the capture was refused' : status) };
        }
        // The source tells its subscribers of the edit, and they ask again.
        if (opts.revision() !== at) {
          bitmap.close();
          return { reason: STORY_CHANGED };
        }
        shot = { key: aimed.key, revision: at, bitmap, payload: aimed.payload };
        keep(side, shot);
      }
      return { bitmap: shot.bitmap, dpr: aimed.payload.dpr, box: aimed.payload.box, at: aimed.hit.local };
    },
    remeasure() {
      for (const lens of [...lenses]) lens.measure();
      remeasured.emit();
    },
  };
}
