import {
  canvasToClient,
  clientToCanvas,
  effectivePose,
  type LayoutBox,
  layoutBoxOf,
  type Op,
  type PoseHold,
  type RectPose,
  sceneToAdapter,
  type View,
  viewScreenToWorld,
  viewWorldToScreen,
} from '@weasel-js/core';
import { clamp } from '@weasel-js/geom';
import { type RefObject, useCallback, useRef } from 'react';
import type { LensAttachment } from './LensOverlay';
import { type LensActionApi, MAX_LENSES } from './lensActionDefs';
import { addLensOps, aimAt, lensesOf, lensIdsOf, settingsOf } from './lensScene';
import type { LensSources } from './lensSource';
import { BODY_SIZE, type LensScene, type LensSourceKind, type LoupePoint } from './lensTypes';

const samePose = (a: RectPose, b: RectPose): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Each new lens's body sits this far further along than the last, so lenses added in a row do not stack. */
const STAGGER = 24;

/** A client point in the scene's px: in `frame`'s px, then back through the camera the scene is drawn by. */
function clientToScene(frame: HTMLElement, view: View | undefined, client: LoupePoint): LoupePoint {
  const [x, y] = clientToCanvas(frame, client.x, client.y);
  return view ? viewScreenToWorld(view, { x, y }) : { x, y };
}

/** A scene point in client px: through the camera to `frame`'s px, then out to the client. */
export function sceneToClient(
  frame: HTMLElement,
  view: View | undefined,
  p: LoupePoint,
): LoupePoint {
  const at = view ? viewWorldToScreen(view, p) : p;
  const [x, y] = canvasToClient(frame, at.x, at.y);
  return { x, y };
}

/** Where the lab body lies in the scene's px: the region a new lens is kept inside. */
interface Region {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function regionOf(body: HTMLElement, frame: HTMLElement, view: View | undefined): Region {
  const box: LayoutBox = layoutBoxOf(body);
  const a = clientToScene(frame, view, { x: box.left, y: box.top });
  const b = clientToScene(frame, view, {
    x: box.left + box.width * box.scale.x,
    y: box.top + box.height * box.scale.y,
  });
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

/** A new body beside its reticle, in the frame's px, flipped left where the right has no room. */
function bodyBeside(reticle: LoupePoint, region: Region, n: number): LoupePoint {
  const half = BODY_SIZE / 2;
  const gap = BODY_SIZE * 0.75 + STAGGER * n;
  const x = reticle.x + gap + half > region.right ? reticle.x - gap : reticle.x + gap;
  return {
    x: clamp(x, region.left + half, region.right - half),
    y: clamp(reticle.y + STAGGER * n, region.top + half, region.bottom - half),
  };
}

/** A lens's reticle and body centers in client px, from the scene's px drawn through `attachment` in `frame` (see
 *  {@link LensApiRefs.frame}), which an ancestor transform scales. */
export function lensClient<C>(
  scene: LensScene<C>,
  lensId: string,
  frame: HTMLElement | null,
  attachment?: LensAttachment,
): { reticle: LoupePoint; body: LoupePoint } | null {
  const ids = lensIdsOf(scene, `${lensId}:body`);
  const reticle = ids ? scene.get(ids.reticle) : undefined;
  const lens = ids ? scene.get(ids.body) : undefined;
  if (!frame || !reticle || !lens) return null;
  const view = attachment?.view();
  const center = (p: RectPose) =>
    sceneToClient(frame, view, { x: p.x + p.width / 2, y: p.y + p.height / 2 });
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
  /** The element whose px the scene holds: the surface container the lens canvas covers, which is the lab body's
   *  over layer under a lab's own surface and a host's container under an outer one. Default `body`. */
  frame?: RefObject<HTMLElement | null>;
  /** The camera the host's `<LensOverlay>` draws the scene through, the same one it is passed. Default none. */
  attachment?: LensAttachment;
  pointer: RefObject<LoupePoint | null>;
  focus: RefObject<string | null>;
  sources: RefObject<LensSources<C>>;
  /** Opens the compare menu on a lens; a host with none leaves it out. */
  compare?: RefObject<((lensId: string) => void) | null>;
}

/** The lens API the lens actions drive, in client px at its edges and the scene's px, through its camera, inside. */
export function createLensApi<C>(scene: LensScene<C>, refs: LensApiRefs<C>): LensActionApi<C> {
  let next = 0;
  // Each held lens, and the aim it was held under: the hold is on the node that aim moves.
  const holds = new Map<
    string,
    { hold: PoseHold<RectPose>; aim: string | undefined; at: LoupePoint }
  >();
  // Subscribed only while a lens is held, so an api a host drops leaves no listener on a scene that outlives it.
  let unsubscribe: (() => void) | null = null;
  const release = (lensId: string) => {
    holds.get(lensId)?.hold.drop();
    holds.delete(lensId);
    if (holds.size === 0) {
      unsubscribe?.();
      unsubscribe = null;
    }
  };
  // An undo, a redo or a write from outside the actions can also change a held lens's aim, and a new factor the
  // size of the patch a held reticle marks.
  const watch = () => {
    unsubscribe ??= scene.subscribe(() => {
      for (const [lensId, { aim, at }] of [...holds]) {
        if (settingsOf(scene, lensId)?.aim !== aim) release(lensId);
        else hold(lensId, at);
      }
    });
  };
  const hold = (lensId: string, at: LoupePoint) => {
    const held = holds.get(lensId);
    const aimed = held && aimAt(scene, lensId, at);
    if (!held || !aimed) return;
    held.at = at;
    const was = scene.overrides.read(aimed.id as never)?.pose;
    if (was && samePose(was, aimed.pose)) return;
    held.hold.set([[aimed.id as never, aimed.pose]]);
  };
  const frameOf = () => refs.frame?.current ?? refs.body.current;
  const toScene = (client: LoupePoint, frame: HTMLElement) =>
    clientToScene(frame, refs.attachment?.view(), client);
  const apply = (ops: readonly Op[]) => {
    if (ops.length > 0) sceneToAdapter(scene).applyOps([...ops], 'lens');
  };
  // A host's scene may outlive an api built over it, so an id is minted past the lenses it already holds.
  const mint = () => {
    let lensId: string;
    do lensId = `lens-${next++}`;
    while (
      lensIdsOf(scene, `${lensId}:body`) !== null ||
      lensIdsOf(scene, `${lensId}:reticle`) !== null
    );
    return lensId;
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
      const frame = frameOf();
      const count = lensesOf(scene).length;
      if (!body || !frame || count >= MAX_LENSES) return null;
      const region = regionOf(body, frame, refs.attachment?.view());
      const client = at ?? refs.pointer.current;
      const reticle = client
        ? toScene(client, frame)
        : { x: (region.left + region.right) / 2, y: (region.top + region.bottom) / 2 };
      const lensId = mint();
      apply(addLensOps(scene, lensId, { body: bodyBeside(reticle, region, count), reticle }));
      refs.focus.current = lensId;
      return lensId;
    },
    follow(client, named) {
      const lensId = named ?? current();
      const frame = frameOf();
      if (lensId === null || !frame) return;
      const at = toScene(client, frame);
      if (aimAt(scene, lensId, at) === null) return;
      if (!holds.has(lensId))
        holds.set(lensId, {
          hold: scene.overrides.hold(),
          aim: settingsOf(scene, lensId)?.aim,
          at,
        });
      watch();
      hold(lensId, at);
    },
    unfollow: release,
    sourceAvailable: (kind: LensSourceKind) =>
      refs.sources.current[kind]?.status() ?? 'not provided',
    openCompareMenu: (lensId) => refs.compare?.current?.(lensId),
  };
}
