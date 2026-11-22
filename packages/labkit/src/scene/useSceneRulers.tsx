import type { SceneCanvasSnap, SurfaceContribution } from '@weasel-js/core';
import { createGuidesLayer, guideSnapSource } from '@weasel-js/guides';
import { Rulers } from '@weasel-js/ui-canvas/components/Rulers';
import { type ReactNode, useContext, useMemo } from 'react';
import { trialRulersEntry } from '../rulers/rulersEntry';
import { TrialGuidesContext } from '../rulers/trialGuides';
import type { RulersOption } from '../rulers/types';
import { useOfferedRulers } from '../rulers/useTrialRulers';

/** What a scene canvas installs for its trial's rulers, beside the props it was given. */
export interface SceneRulers<TLayers> {
  ambient: readonly SurfaceContribution[] | undefined;
  layers: TLayers;
  snap: SceneCanvasSnap | undefined;
  chrome: ReactNode;
}

/**
 * The trial's rulers on a `<SceneCanvas>`, as draw wires its own: the rulers' contribution among `ambient`, the guides
 * drawn over the scene, and the guides among the snap sources while the trial snaps to them. Guide edits are steps
 * of the scene's history, which the trial's Undo steps. Outside a trial, or with no `option`, the props pass through.
 */
export function useSceneRulers<TLayers extends object | undefined>(
  option: RulersOption | undefined,
  given: { ambient?: readonly SurfaceContribution[]; layers?: TLayers; snap?: SceneCanvasSnap },
): SceneRulers<TLayers | undefined> {
  const guides = useContext(TrialGuidesContext);
  const rulers = useOfferedRulers(option, 'down', guides);
  const shown = guides?.shown;
  const shownNow = guides?.shownNow;
  const getGuides = guides?.getGuides;
  const subscribe = guides?.subscribe;
  const entry = useMemo(
    () => (rulers && shownNow ? trialRulersEntry(rulers, shownNow) : null),
    [rulers, shownNow],
  );
  const ambient = useMemo(
    () => (entry ? [...(given.ambient ?? []), entry] : given.ambient),
    [entry, given.ambient],
  );
  const drawn = shown?.guides === true;
  const layers = useMemo(() => {
    if (!rulers || !getGuides) return given.layers;
    const layer = createGuidesLayer({
      id: 'lk-guides',
      getGuides: () => (drawn ? rulers.settled(getGuides()) : []),
      ...(subscribe ? { subscribe } : {}),
      extent: 'full',
    });
    return { ...given.layers, 'lk-guides': { layer, after: 'scene' } } as TLayers;
  }, [rulers, getGuides, subscribe, drawn, given.layers]);
  const source = useMemo(() => (getGuides ? guideSnapSource({ getGuides }) : null), [getGuides]);
  const snapping = shown?.snap === true && drawn;
  const snap = useMemo(() => {
    if (!rulers || !source || !snapping) return given.snap;
    return { ...given.snap, sources: [...(given.snap?.sources ?? []), source] };
  }, [rulers, source, snapping, given.snap]);
  return {
    ambient,
    layers,
    snap,
    chrome: rulers && shown?.rulers ? <Rulers rulers={rulers} /> : null,
  };
}
