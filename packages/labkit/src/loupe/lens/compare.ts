/**
 * Split geometry and the seam a Split lens is divided at: its preview while a
 * drag is under way, the layer that claims a press on it from the lens canvas,
 * and `loupe.seam`, the drag that moves it.
 */
import { type Action, effectivePose, type LayerHit, type RenderLayer } from '@weasel-js/core';
import type { LoupeRect } from '@weasel-js/loupe';
import type { LensActionApi } from './lensActionDefs';
import { lensesOf, setLensOps, settingsOf } from './lensScene';
import type { LensScene, LensSettings } from './lensTypes';

/** How far either side of the seam a press takes it, in screen px. */
export const SEAM_GRAB = 4;
/** How near the left edge a split seam can go, as a fraction of the lens width. */
export const SEAM_MIN = 0.05;
/** How near the right edge a split seam can go, as a fraction of the lens width. */
export const SEAM_MAX = 0.95;
/** The lens canvas layer that claims a press on a seam; the drag routes as `affordance:layer:<id>`. */
export const SEAM_LAYER_ID = 'labkit-lens-seam';

const clampSeam = (seam: number) => Math.min(SEAM_MAX, Math.max(SEAM_MIN, seam));

/** The interior's two halves, either side of `seam` (0 to 1 across it), and where the seam lands. */
export function splitRects(
  interior: LoupeRect,
  seam: number,
): { left: LoupeRect; right: LoupeRect; seamX: number } {
  const seamX = interior.x + Math.round(interior.w * seam);
  return {
    left: { x: interior.x, y: interior.y, w: seamX - interior.x, h: interior.h },
    right: { x: seamX, y: interior.y, w: interior.x + interior.w - seamX, h: interior.h },
    seamX,
  };
}

/** Which renders a lens shows: the story as it is, the compared one, or both either side of the seam. */
export type LensSide = 'base' | 'compared';

/** The sides a lens shows: the story alone with no comparison, both in Split, else the compared one. */
export function lensSides<C>(settings: LensSettings<C>): readonly LensSide[] {
  if (settings.compare === null) return ['base'];
  return settings.view === 'split' ? ['base', 'compared'] : ['compared'];
}

/** Whether a lens shows a seam: it compares, in Split. */
export const showsSeam = <C>(settings: LensSettings<C>): boolean =>
  settings.compare !== null && settings.view === 'split';

/** Each seam a drag is moving, by lens, before the drag commits it. */
export interface SeamPreview {
  get(lensId: string): number | undefined;
  set(lensId: string, seam: number | undefined): void;
  subscribe(listener: () => void): () => void;
  /** Bumped on every change, for `useSyncExternalStore`. */
  version(): number;
}

/** An empty seam preview, which a seam drag writes to until it commits. */
export function createSeamPreview(): SeamPreview {
  const seams = new Map<string, number>();
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    get: (lensId) => seams.get(lensId),
    set(lensId, seam) {
      if (seams.get(lensId) === seam) return;
      if (seam === undefined) seams.delete(lensId);
      else seams.set(lensId, seam);
      version += 1;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}

/** A lens's seam as it shows now: the drag's preview while one is under way, else its setting. */
export const seamOf = <C>(
  settings: LensSettings<C>,
  preview: SeamPreview | undefined,
  lensId: string,
) => preview?.get(lensId) ?? settings.seam;

/** The lens whose seam lies at the world point, within `SEAM_GRAB` screen px at
 *  `scale`. Only the topmost body under the point counts: a press on a lens over
 *  another's seam belongs to the lens on top. */
export function seamHit<C>(
  scene: LensScene<C>,
  preview: SeamPreview | undefined,
  x: number,
  y: number,
  scale: number,
): { lensId: string } | null {
  const grab = SEAM_GRAB / (scale || 1);
  for (const { lensId, body } of [...lensesOf(scene)].reverse()) {
    const settings = settingsOf(scene, lensId);
    const node = scene.get(body);
    if (!settings || !node) continue;
    const p = effectivePose(scene, node);
    if (x < p.x - grab || x > p.x + p.width + grab || y < p.y || y > p.y + p.height) continue;
    if (!showsSeam(settings)) return null;
    const { seamX } = splitRects(
      { x: p.x, y: p.y, w: p.width, h: p.height },
      seamOf(settings, preview, lensId),
    );
    return Math.abs(x - seamX) <= grab ? { lensId } : null;
  }
  return null;
}

/** The layer the lens canvas registers so a press on a seam reaches `loupe.seam` instead of the body's move. */
export function seamLayer<C>(scene: LensScene<C>, preview: SeamPreview): RenderLayer<unknown> {
  return {
    id: SEAM_LAYER_ID,
    label: 'Lens seams',
    draw: () => [],
    hitTest: (wx, wy, _data, view): LayerHit | null => {
      const hit = seamHit(scene, preview, wx, wy, view.scale.x);
      return hit
        ? {
            initialScratch: hit,
            strength: 'exclusive',
            claimedKinds: ['pointer'],
            cursor: 'ew-resize',
          }
        : null;
    },
  };
}

/**
 * `loupe.seam`: a drag on a Split lens's seam. It previews through `preview`
 * and writes nothing until release, which commits one data op.
 */
export function seamAction<C>(
  api: Pick<LensActionApi<C>, 'scene' | 'apply'>,
  preview: SeamPreview = createSeamPreview(),
): Action {
  const { scene } = api;
  return {
    id: 'loupe.seam',
    label: 'Move the split seam',
    group: 'loupe',
    defaultBinding: { kind: 'drag', target: `affordance:layer:${SEAM_LAYER_ID}` },
    activeCursor: 'ew-resize',
    invoker: {
      timing: 'ongoing',
      start(ctx) {
        const lensId = (ctx.drag?.affordance?.payload as { lensId?: string } | undefined)?.lensId;
        const body = lensId === undefined ? undefined : scene.get(`${lensId}:body` as never);
        if (lensId === undefined || !body) return {};
        const p = effectivePose(scene, body);
        const at = (x: number) => clampSeam((x - p.x) / (p.width || 1));
        return {
          kind: 'seam',
          onMove: (move) => preview.set(lensId, at(move.world.x)),
          onEnd(end, reason) {
            const seam = preview.get(lensId) ?? at(end.world.x);
            preview.set(lensId, undefined);
            if (reason === 'commit') api.apply(setLensOps(scene, lensId, { seam }));
          },
        };
      },
    },
  };
}
