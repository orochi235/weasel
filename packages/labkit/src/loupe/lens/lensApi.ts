import {
  effectivePose,
  type Op,
  type PoseHold,
  type RectPose,
  sceneToAdapter,
} from '@weasel-js/core';
import { type RefObject, useCallback, useRef } from 'react';
import { type LensActionApi, MAX_LENSES } from './lensActionDefs';
import { addLensOps, aimAt, lensesOf, lensIdsOf, settingsOf } from './lensScene';
import type { LensSources } from './lensSource';
import { BODY_SIZE, type LensScene, type LensSourceKind, type LoupePoint } from './lensTypes';

/** Each new lens's body sits this far further along than the last, so lenses added in a row do not stack. */
const STAGGER = 24;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** A new body beside its reticle, in lab-body px, flipped left where the right has no room. */
function bodyBeside(reticle: LoupePoint, box: DOMRect, n: number): LoupePoint {
  const half = BODY_SIZE / 2;
  const gap = BODY_SIZE * 0.75 + STAGGER * n;
  const x = reticle.x + gap + half > box.width ? reticle.x - gap : reticle.x + gap;
  return {
    x: clamp(x, half, box.width - half),
    y: clamp(reticle.y + STAGGER * n, half, box.height - half),
  };
}

/** A lens's reticle and body centers in client px, from the scene's lab-body px. */
export function lensClient<C>(
  scene: LensScene<C>,
  lensId: string,
  body: HTMLElement | null,
): { reticle: LoupePoint; body: LoupePoint } | null {
  const ids = lensIdsOf(scene, `${lensId}:body`);
  const reticle = ids ? scene.get(ids.reticle) : undefined;
  const lens = ids ? scene.get(ids.body) : undefined;
  if (!body || !reticle || !lens) return null;
  const box = body.getBoundingClientRect();
  const center = (p: RectPose) => ({
    x: box.left + p.x + p.width / 2,
    y: box.top + p.y + p.height / 2,
  });
  return {
    reticle: center(effectivePose(scene, reticle)),
    body: center(effectivePose(scene, lens)),
  };
}

/**
 * The lens the lens actions act on, held in a ref so a chrome toggle's focus lands before its action reads it.
 * `LensOverlay` reports through `onFocusLens` both the chrome's focus and every selection the lens canvas makes.
 */
export function useLensFocus() {
  const focus = useRef<string | null>(null);
  const onFocusLens = useCallback((lensId: string | null) => {
    focus.current = lensId;
  }, []);
  return { focus, onFocusLens };
}

/** What {@link createLensApi} reads as it acts: the lab body, the last pointer, the focused lens and the sources. */
export interface LensApiRefs<C> {
  body: RefObject<HTMLElement | null>;
  pointer: RefObject<LoupePoint | null>;
  focus: RefObject<string | null>;
  sources: RefObject<LensSources<C>>;
  /** Opens the compare menu on a lens; a host with none leaves it out. */
  compare?: RefObject<((lensId: string) => void) | null>;
}

/** The lens API the lens actions drive, in client px at its edges and lab-body px in the scene. */
export function createLensApi<C>(scene: LensScene<C>, refs: LensApiRefs<C>): LensActionApi<C> {
  let next = 0;
  // Each held lens, and the aim it was held under: the hold is on the node that aim moves.
  const holds = new Map<string, { hold: PoseHold<RectPose>; aim: string | undefined }>();
  const release = (lensId: string) => {
    holds.get(lensId)?.hold.drop();
    holds.delete(lensId);
  };
  // An undo, a redo or a write from outside the actions can also change a held lens's aim.
  scene.subscribe(() => {
    for (const [lensId, { aim }] of [...holds])
      if (settingsOf(scene, lensId)?.aim !== aim) release(lensId);
  });
  const toBody = (client: LoupePoint, box: DOMRect) => ({
    x: client.x - box.left,
    y: client.y - box.top,
  });
  const apply = (ops: readonly Op[]) => {
    if (ops.length > 0) sceneToAdapter(scene).applyOps([...ops], 'lens');
  };
  const current = () => {
    const focused = refs.focus.current;
    if (focused !== null && settingsOf(scene, focused)) return focused;
    return lensesOf(scene).at(-1)?.lensId ?? null;
  };
  return {
    scene,
    current,
    apply,
    add(at) {
      const body = refs.body.current;
      const count = lensesOf(scene).length;
      if (!body || count >= MAX_LENSES) return null;
      const box = body.getBoundingClientRect();
      const client = at ??
        refs.pointer.current ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const reticle = toBody(client, box);
      const lensId = `lens-${next++}`;
      apply(addLensOps(scene, lensId, { body: bodyBeside(reticle, box, count), reticle }));
      refs.focus.current = lensId;
      return lensId;
    },
    follow(client, named) {
      const lensId = named ?? current();
      const body = refs.body.current;
      if (lensId === null || !body) return;
      const aimed = aimAt(scene, lensId, toBody(client, body.getBoundingClientRect()));
      if (aimed === null) return;
      const held = holds.get(lensId) ?? {
        hold: scene.overrides.hold(),
        aim: settingsOf(scene, lensId)?.aim,
      };
      holds.set(lensId, held);
      held.hold.set([[aimed.id as never, aimed.pose]]);
    },
    unfollow: release,
    sourceAvailable: (kind: LensSourceKind) =>
      refs.sources.current[kind]?.status() ?? 'not provided',
    openCompareMenu: (lensId) => refs.compare?.current?.(lensId),
  };
}
