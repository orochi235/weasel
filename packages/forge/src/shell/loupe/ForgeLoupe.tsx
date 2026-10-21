import './loupe.css';
import { type Op, type PoseHold, type RectPose, sceneToAdapter, useLatest } from '@weasel-js/core';
import { useLabContext } from '@weasel-js/labkit';
import {
  addLensOps,
  BODY_SIZE,
  createLensScene,
  LensActions,
  type LensActionApi,
  LensOverlay,
  type LensScene,
  type LensSourceKind,
  type LensSources,
  lensesOf,
  lensIdsOf,
  type LoupePoint,
  MAX_LENSES,
  RETICLE_SIZE,
  settingsOf,
} from '@weasel-js/labkit/loupe';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';
import { type RefObject, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import type { GlobalDeclarations } from '../globals';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { type ForgeComparison, resolveComparison } from './conditions';
import { LiveLensesContext } from './liveLenses';
import { createLiveSource, type LiveSource } from './liveSource';

/** Props for `ForgeLoupe`. */
export interface ForgeLoupeProps {
  declarations: GlobalDeclarations;
  /** The global holding the color mode, which opposite mode flips. */
  modeGlobal: string;
}

/** Each new lens's body sits this far further along than the last, so lenses added in a row do not stack. */
const STAGGER = 24;
const OPPOSITE: ForgeComparison = { kind: 'opposite-mode' };

function describe(c: ForgeComparison): string {
  if (c.kind === 'opposite-mode') return 'Opposite mode';
  const globals = Object.entries(c.globals ?? {}).map(([key, value]) => `${key}: ${value}`);
  const args = Object.entries(c.args ?? {}).map(([path, value]) => `Arg ${path} = ${String(value)}`);
  return [...globals, ...args, ...(c.dpr ? [`DPR ${c.dpr}×`] : [])].join(', ') || 'As it is';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** A new body beside its reticle, in lab-body px, flipped left where the right has no room. */
function bodyBeside(reticle: LoupePoint, box: DOMRect, n: number): LoupePoint {
  const half = BODY_SIZE / 2;
  const gap = BODY_SIZE * 0.75 + STAGGER * n;
  const x = reticle.x + gap + half > box.width ? reticle.x - gap : reticle.x + gap;
  return { x: clamp(x, half, box.width - half), y: clamp(reticle.y + STAGGER * n, half, box.height - half) };
}

/**
 * The lens the lens actions act on, held in a ref so a chrome toggle's focus lands before its action reads it.
 * Every selection the lens canvas makes, the same lens again included, puts it back on the selected lens.
 */
export function useLensFocus(scene: LensScene<ForgeComparison>) {
  const focus = useRef<string | null>(null);
  useEffect(() => {
    let last = scene.getSelection();
    return scene.subscribe(() => {
      const selection = scene.getSelection();
      if (selection === last) return;
      last = selection;
      const first = selection[0];
      focus.current = first === undefined ? null : (lensIdsOf(scene, first)?.lensId ?? null);
    });
  }, [scene]);
  const onFocusLens = useCallback((lensId: string | null) => {
    focus.current = lensId;
  }, []);
  return { focus, onFocusLens };
}

/** The lens API the actions drive, in client px at its edges and lab-body px in the scene. */
export function createApi(
  scene: LensScene<ForgeComparison>,
  refs: {
    body: RefObject<HTMLElement | null>;
    pointer: RefObject<LoupePoint | null>;
    focus: RefObject<string | null>;
    sources: RefObject<LensSources<ForgeComparison>>;
  },
): LensActionApi<ForgeComparison> {
  let next = 0;
  let hold: PoseHold<RectPose> | null = null;
  const toBody = (client: LoupePoint, box: DOMRect) => ({ x: client.x - box.left, y: client.y - box.top });
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
      const client = at ?? refs.pointer.current ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const reticle = toBody(client, box);
      const lensId = `lens-${next++}`;
      apply(addLensOps(scene, lensId, { body: bodyBeside(reticle, box, count), reticle }));
      refs.focus.current = lensId;
      return lensId;
    },
    follow(client) {
      const lensId = current();
      const body = refs.body.current;
      if (lensId === null || !body) return;
      const p = toBody(client, body.getBoundingClientRect());
      const half = RETICLE_SIZE / 2;
      hold ??= scene.overrides.hold();
      hold.set([[`${lensId}:reticle` as never, { x: p.x - half, y: p.y - half, width: RETICLE_SIZE, height: RETICLE_SIZE }]]);
    },
    sourceAvailable: (kind: LensSourceKind) => refs.sources.current[kind]?.status() ?? 'not provided',
    // The compare menu is not built yet.
    openCompareMenu: () => {},
  };
}

/** Has `live` look again whenever what lies under a lens can change without a reticle moving. */
function useRemeasure(live: LiveSource | null, body: HTMLElement | null, rerender: () => void) {
  const { trials, mode } = useLabContext();
  const labValues = useContext(StoryGlobalsContext);
  useEffect(() => {
    live?.remeasure();
  }, [live, trials, mode, labValues]);
  useEffect(() => {
    if (!live || !body) return;
    const remeasure = () => live.remeasure();
    // A resize can move the lab body, and with it every reticle's client point, which only a render recomputes.
    const resize = () => {
      rerender();
      live.remeasure();
    };
    body.addEventListener('scroll', remeasure, { capture: true, passive: true });
    window.addEventListener('resize', resize);
    return () => {
      body.removeEventListener('scroll', remeasure, { capture: true });
      window.removeEventListener('resize', resize);
    };
  }, [live, body, rerender]);
}

/**
 * The workshop's lenses: the lens canvas over the lab, its actions in the Loupe keymap, the hint for that keymap, and
 * a Live source rendering a second copy of whichever story sits under each reticle. Lenses last as long as the
 * workshop does and are never stored.
 */
export function ForgeLoupe({ declarations, modeGlobal }: ForgeLoupeProps) {

  const lenses = useContext(LiveLensesContext);
  const labValues = useContext(StoryGlobalsContext);
  const { mode } = useLabContext();
  const [scene] = useState(createLensScene<ForgeComparison>);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const pointer = useRef<LoupePoint | null>(null);
  const { focus, onFocusLens } = useLensFocus(scene);
  const conditions = useLatest({ labValues, mode, declarations, modeGlobal });
  const [live] = useState(() =>
    lenses
      ? createLiveSource(lenses, resolveComparison, () => {
          const c = conditions.current;
          const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
          return {
            base: c.labValues,
            ctx: { declarations: c.declarations, modeGlobal: c.modeGlobal, prefersDark, labMode: c.mode },
          };
        })
      : null,
  );
  const sources = useMemo<LensSources<ForgeComparison>>(() => (live ? { live } : {}), [live]);
  const sourcesRef = useLatest(sources);
  const [api] = useState(() => createApi(scene, { body: bodyRef, pointer, focus, sources: sourcesRef }));
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // A Follow reticle moves through the scene's overrides, which bump no version; the lenses re-read it on a render.
  useSyncExternalStore(scene.overrides.subscribe, scene.overrides.getGeneration);
  useRemeasure(live, body, rerender);

  useEffect(() => {
    if (!body) return;
    const track = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    body.addEventListener('pointermove', track, { passive: true });
    return () => body.removeEventListener('pointermove', track);
  }, [body]);

  // An overlay contribution renders inside the lab body, which is what this finds; the marker itself shows nothing.
  const attachMarker = useCallback((el: HTMLElement | null) => {
    const found = el?.closest<HTMLElement>('.lk-lab__body') ?? null;
    bodyRef.current = found;
    setBody(found);
  }, []);
  const opposite = useCallback(() => OPPOSITE, []);

  return (
    <>
      <span hidden ref={attachMarker} />
      <LensOverlay scene={scene} sources={sources} describe={describe} onFocusLens={onFocusLens} />
      <LensActions api={api} bodyRef={bodyRef} opposite={opposite} />
      <KeymapHint className="fg-loupe-hint" />
    </>
  );
}
