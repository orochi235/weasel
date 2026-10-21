import './loupe.css';
import { effectivePose, type Op, type PoseHold, type RectPose, sceneToAdapter, useLatest } from '@weasel-js/core';
import { useLabContext } from '@weasel-js/labkit';
import {
  addLensOps,
  BODY_SIZE,
  createLensScene,
  LensActions,
  type LensActionApi,
  type LensDescribeContext,
  LensOverlay,
  type LensScene,
  type LensSourceKind,
  type LensSources,
  lensesOf,
  lensIdsOf,
  type LoupePoint,
  MAX_LENSES,
  resolveSource,
  reticleAt,
  settingsOf,
} from '@weasel-js/labkit/loupe';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';
import { type RefObject, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import type { GlobalDeclarations } from '../globals';
import { StoryGlobalsContext } from '../StoryGlobalsContext';
import { CompareMenu, type CompareMenuRequest, compareChoices } from './CompareMenu';
import { describeLens, type ForgeComparison, type LabConditions, resolveComparison, resolveContextOf } from './conditions';
import { LiveLensesContext } from './liveLenses';
import { createLiveSource } from './liveSource';
import { renderReadouts } from './readouts';
import { trialAt } from './trialAt';
import { usePixelsSource } from './usePixelsSource';

/** Props for `ForgeLoupe`. */
export interface ForgeLoupeProps {
  declarations: GlobalDeclarations;
  /** The global holding the color mode, which opposite mode flips. */
  modeGlobal: string;
}

/** Each new lens's body sits this far further along than the last, so lenses added in a row do not stack. */
const STAGGER = 24;
const OPPOSITE: ForgeComparison = { kind: 'opposite-mode' };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** A new body beside its reticle, in lab-body px, flipped left where the right has no room. */
function bodyBeside(reticle: LoupePoint, box: DOMRect, n: number): LoupePoint {
  const half = BODY_SIZE / 2;
  const gap = BODY_SIZE * 0.75 + STAGGER * n;
  const x = reticle.x + gap + half > box.width ? reticle.x - gap : reticle.x + gap;
  return { x: clamp(x, half, box.width - half), y: clamp(reticle.y + STAGGER * n, half, box.height - half) };
}

/** A lens's reticle and body centers in client px, from the scene's lab-body px. */
function lensClient(
  scene: LensScene<ForgeComparison>,
  lensId: string,
  body: HTMLElement | null,
): { reticle: LoupePoint; body: LoupePoint } | null {
  const ids = lensIdsOf(scene, `${lensId}:body`);
  const reticle = ids ? scene.get(ids.reticle) : undefined;
  const lens = ids ? scene.get(ids.body) : undefined;
  if (!body || !reticle || !lens) return null;
  const box = body.getBoundingClientRect();
  const center = (p: RectPose) => ({ x: box.left + p.x + p.width / 2, y: box.top + p.y + p.height / 2 });
  return { reticle: center(effectivePose(scene, reticle)), body: center(effectivePose(scene, lens)) };
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

/** The lens API the actions drive, in client px at its edges and lab-body px in the scene. */
export function createApi(
  scene: LensScene<ForgeComparison>,
  refs: {
    body: RefObject<HTMLElement | null>;
    pointer: RefObject<LoupePoint | null>;
    focus: RefObject<string | null>;
    sources: RefObject<LensSources<ForgeComparison>>;
    /** Opens the compare menu on a lens. */
    compare?: RefObject<((lensId: string) => void) | null>;
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
      const pose = reticleAt(scene, lensId, toBody(client, body.getBoundingClientRect()));
      if (pose === null) return;
      hold ??= scene.overrides.hold();
      hold.set([[`${lensId}:reticle` as never, pose]]);
    },
    sourceAvailable: (kind: LensSourceKind) => refs.sources.current[kind]?.status() ?? 'not provided',
    openCompareMenu: (lensId) => refs.compare?.current?.(lensId),
  };
}

/** A source whose attached lenses can be told to look again at what lies under them. */
interface Remeasurable {
  remeasure(): void;
}

/** Has each source look again whenever what lies under a lens can change without a reticle moving. */
export function useRemeasure(sources: readonly Remeasurable[], body: HTMLElement | null, rerender: () => void) {
  const { trials, mode } = useLabContext();
  const labValues = useContext(StoryGlobalsContext);
  useEffect(() => {
    for (const source of sources) source.remeasure();
  }, [sources, trials, mode, labValues]);
  useEffect(() => {
    if (sources.length === 0 || !body) return;
    const remeasure = () => {
      for (const source of sources) source.remeasure();
    };
    // A resize can move the lab body, and with it every reticle's client point, which only a render recomputes.
    const resize = () => {
      rerender();
      remeasure();
    };
    body.addEventListener('scroll', remeasure, { capture: true, passive: true });
    window.addEventListener('resize', resize);
    return () => {
      body.removeEventListener('scroll', remeasure, { capture: true });
      window.removeEventListener('resize', resize);
    };
  }, [sources, body, rerender]);
}

/**
 * The workshop's lenses: the lens canvas over the lab, its actions in the Loupe keymap, the hint for that keymap, a
 * Live source rendering a second copy of whichever story sits under each reticle, and a Pixels source showing a real
 * capture of it. Lenses last as long as the workshop does and are never stored.
 */
export function ForgeLoupe({ declarations, modeGlobal }: ForgeLoupeProps) {
  const lenses = useContext(LiveLensesContext);
  const labValues = useContext(StoryGlobalsContext);
  const { mode, trials, instruments } = useLabContext();
  const [scene] = useState(createLensScene<ForgeComparison>);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const pointer = useRef<LoupePoint | null>(null);
  const { focus, onFocusLens } = useLensFocus();
  const conditions = useLatest<LabConditions>({ labValues, mode, declarations, modeGlobal });
  const [live] = useState(() =>
    lenses
      ? createLiveSource(lenses, resolveComparison, () => ({ base: conditions.current.labValues, ctx: resolveContextOf(conditions.current) }))
      : null,
  );
  const pixels = usePixelsSource(conditions);
  const sources = useMemo<LensSources<ForgeComparison>>(
    () => ({ ...(live ? { live } : {}), ...(pixels ? { pixels } : {}) }),
    [live, pixels],
  );
  const remeasured = useMemo(() => [live, pixels].filter((s) => s !== null), [live, pixels]);
  const sourcesRef = useLatest(sources);
  const [menu, setMenu] = useState<CompareMenuRequest | null>(null);
  // The menu offers the args of the story under the lens's reticle, as it is when the menu opens.
  const compare = useLatest((lensId: string) => {
    const at = lensClient(scene, lensId, bodyRef.current);
    if (!at) return;
    const trialId = trialAt(at.reticle)?.trialId;
    const name = trials.find((t) => t.id === trialId)?.instrumentName;
    const schema = instruments.find((i) => i.name === name)?.config ?? null;
    const settings = settingsOf(scene, lensId);
    // Difference compares two Pixels captures whatever the lens's source.
    const pixels =
      settings !== null &&
      (settings.view === 'difference' || resolveSource(settings.source, sourcesRef.current).source?.kind === 'pixels');
    const choices = compareChoices(declarations, schema);
    setMenu((last) => ({ seq: (last?.seq ?? 0) + 1, client: at.body, lensId, pixels, choices }));
  });
  const [api] = useState(() => createApi(scene, { body: bodyRef, pointer, focus, sources: sourcesRef, compare }));
  // Named against the trial under the reticle, whose pins the lens renders under.
  const describe = useCallback(
    (c: ForgeComparison, at: LensDescribeContext) => {
      const trialId = trialAt(at.reticle)?.trialId;
      const config = trials.find((t) => t.id === trialId)?.config;
      return describeLens(c, { labValues, mode, declarations, modeGlobal }, config, at.source === 'pixels');
    },
    [declarations, labValues, mode, modeGlobal, trials],
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // A Follow reticle moves through the scene's overrides, which bump no version; the lenses re-read it on a render.
  useSyncExternalStore(scene.overrides.subscribe, scene.overrides.getGeneration);
  useRemeasure(remeasured, body, rerender);

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
      <LensOverlay scene={scene} sources={sources} describe={describe} renderReadouts={renderReadouts} onFocusLens={onFocusLens} />
      <LensActions api={api} bodyRef={bodyRef} opposite={opposite} />
      <CompareMenu api={api} request={menu} />
      <KeymapHint className="fg-loupe-hint" />
    </>
  );
}
