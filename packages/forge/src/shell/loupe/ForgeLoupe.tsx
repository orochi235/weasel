import './loupe.css';
import { useLatest, useVisibleRaf } from '@weasel-js/core';
import { useLabContext } from '@weasel-js/labkit';
import {
  createLensApi,
  createLensScene,
  LensActions,
  type LensDescribeContext,
  LensOverlay,
  type LensSources,
  type LoupePoint,
  lensClient,
  resolveSource,
  settingsOf,
  useLensFocus,
  useLensRemeasure,
} from '@weasel-js/labkit/loupe';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
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

const OPPOSITE: ForgeComparison = { kind: 'opposite-mode' };

/** Runs the last function handed to it on the next visible frame, once however many arrive before then. */
function useFrameSchedule(): (run: () => void) => void {
  const next = useRef<(() => void) | null>(null);
  const frame = useVisibleRaf(() => {
    const run = next.current;
    next.current = null;
    run?.();
  });
  return useCallback(
    (run: () => void) => {
      next.current = run;
      frame.request();
    },
    [frame],
  );
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
  const onFrame = useFrameSchedule();
  const [live] = useState(() =>
    lenses
      ? createLiveSource(
          lenses,
          resolveComparison,
          () => ({ base: conditions.current.labValues, ctx: resolveContextOf(conditions.current) }),
          onFrame,
        )
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
  const [api] = useState(() => createLensApi(scene, { body: bodyRef, pointer, focus, sources: sourcesRef, compare }));
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
  useLensRemeasure(remeasured, body, rerender, labValues);

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
