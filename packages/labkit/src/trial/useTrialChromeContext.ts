import { useMemo } from 'react';
import { useRegisteredCamera } from '../canvas/cameraRegistry';
import { zoomCameraTo } from '../canvas/cameraZoom';
import type { ToolSlotContext, TrialChromeContext } from '../chrome/types';
import { useLabOverValues } from '../config/over';
import type { LabCommands } from '../lab/LabContext';
import { useLightboxControl } from '../lightbox/LightboxContext';
import type { TrialGuidesChrome } from '../rulers/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { as2DView, DEFAULT_VIEW, withZoom } from '../state/view';
import type { InstrumentCamera } from './homeView';
import type { TrialActions } from './TrialScope';
import { useTrialPanels } from './useTrialPanels';

type CameraKind = NonNullable<InstrumentCamera>['kind'] | null;

/** The trial's loupe as its chrome sees it: its switch, the eyedropper's, and
 *  the color last picked through either. */
export interface LoupeBindings {
  on: boolean;
  toggle: () => void;
  dropper: boolean;
  toggleDropper: () => void;
  picked: string | null;
}

/** The trial's undo history as its chrome sees it. */
export interface UndoBindings {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const NO_OP = (): void => {};
const NO_RUN = (): boolean => false;

/** One frozen empty map, so a trial that has folded nothing keeps a stable
 *  context identity across renders. */
const NO_SECTIONS: Readonly<Record<string, boolean>> = Object.freeze({});

/** The chrome context's loupe fields, from the trial's bindings: all off while no lens is mounted. */
function loupeChrome(loupe: LoupeBindings | undefined) {
  return {
    hasLoupe: loupe != null,
    loupeOn: loupe?.on ?? false,
    toggleLoupe: loupe?.toggle ?? NO_OP,
    dropperOn: loupe?.dropper ?? false,
    toggleDropper: loupe?.toggleDropper ?? NO_OP,
    pickedColor: loupe?.picked ?? null,
  };
}

/** The trial's Undo and Redo as its chrome offers them: inert without bindings. */
const undoChrome = (b: UndoBindings | undefined) =>
  ({
    canUndo: b?.canUndo ?? false,
    canRedo: b?.canRedo ?? false,
    undo: b?.undo ?? NO_OP,
    redo: b?.redo ?? NO_OP,
  }) satisfies Partial<TrialChromeContext>;

/** The trial view is opaque to labkit, so the zoom chrome asks for the 2D shape and goes inert
 *  when the trial holds something else — an orbit, say. An unplaced view on a 2D camera reads as
 *  the default its canvas paints, so the status strip is in before the first fit. */
const chromeView = (view: unknown, cameraKind: CameraKind) =>
  as2DView(view) ??
  (view === null && (cameraKind === 'canvas' || cameraKind === 'stage') ? DEFAULT_VIEW : null);

/** The lab's commands on one trial: its snapshots and the title bar's actions. */
const labOpsOn = (lab: LabCommands, trialId: string) =>
  ({
    savedSnapshots: lab.savedSnapshots.filter((s) => s.trialId === trialId),
    saveSnapshot: (name?: string) => lab.saveSnapshot(trialId, name),
    loadSnapshot: (snapshotId: string) => lab.loadSnapshot(trialId, snapshotId),
    clone: () => lab.cloneTrial(trialId),
    reset: () => lab.resetTrial(trialId),
    close: () => lab.closeTrial(trialId),
  }) satisfies Partial<TrialChromeContext>;

/** What a trial's chrome context is built from, beyond what it reads from the lab around it. */
export interface TrialChromeSources
  extends Pick<
    TrialChromeContext,
    'title' | 'isLastTrial' | 'configSchema' | 'auto' | 'reported' | 'setConfig' | 'draftConfig'
  > {
  trialId: string;
  record: TrialRecord;
  /** The kind of camera the trial's instrument declares, `null` for none. */
  cameraKind: CameraKind;
  lab: LabCommands;
  store: LabStore;
  undoBindings: UndoBindings | undefined;
  loupe: LoupeBindings | undefined;
  guides?: TrialGuidesChrome;
  toolSlot: ToolSlotContext;
  actions: TrialActions | undefined;
}

/** The one context every region of a trial's chrome reads: the trial's fields and the writes on them, its zoom on
 *  whichever camera it last used, its loupe, lightbox, undo, panels and tool slot. */
export function useTrialChromeContext({
  trialId,
  record,
  cameraKind,
  lab,
  store,
  title,
  isLastTrial,
  undoBindings,
  loupe,
  guides,
  toolSlot,
  actions,
  configSchema,
  auto,
  reported,
  setConfig,
  draftConfig,
}: TrialChromeSources): TrialChromeContext {
  // A store's actions never change, so they are read once rather than subscribed to.
  const writes = useMemo(() => store.getState(), [store]);
  const panels = useTrialPanels(store, trialId);
  const overValues = useLabOverValues();

  // A trial's own camera zooms about the view's middle, in the instrument's range, as the lab's does.
  const camera = useRegisteredCamera(trialId);

  // The title bar carries the expand toggle, so the lightbox drops its own.
  const lightbox = useLightboxControl();

  return useMemo<TrialChromeContext>(() => {
    const view2d = chromeView(record.view, cameraKind);
    const setZoom = (z: number): void => {
      if (camera) zoomCameraTo(camera, z);
      else if (view2d) writes.updateTrialView(trialId, withZoom(view2d, z));
    };
    return {
      trialId,
      instrumentName: record.instrumentName,
      title,
      setTitle: (next) => writes.setTrialTitle(trialId, next),
      isLastTrial,
      zoom: camera ? camera.zoomOf(record.view) : (view2d?.zoom ?? null),
      setZoom,
      ...undoChrome(undoBindings),
      runAction: actions?.run ?? NO_RUN,
      ...loupeChrome(loupe),
      ...(guides ? { guides: { shown: guides.shown, toggle: guides.toggle } } : {}),
      canExpand: lightbox != null,
      expanded: lightbox?.expanded ?? false,
      toggleExpanded: lightbox?.toggle ?? NO_OP,
      configSchema,
      config: record.config,
      auto,
      reported,
      setConfig,
      draftConfig,
      overValues,
      collapsedSections: record.collapsedSections ?? NO_SECTIONS,
      setSectionCollapsed: (key, collapsed) =>
        writes.setTrialSectionCollapsed(trialId, key, collapsed),
      colorMode: record.colorMode ?? 'auto',
      setColorMode: (mode) => writes.setTrialColorMode(trialId, mode),
      undockedPanels: panels.undocked,
      undockPanel: panels.undockPanel,
      dockPanel: panels.dockPanel,
      ...labOpsOn(lab, trialId),
      ...toolSlot,
    };
  }, [
    trialId,
    record,
    cameraKind,
    lab,
    title,
    isLastTrial,
    setConfig,
    draftConfig,
    undoBindings,
    loupe,
    guides,
    lightbox,
    toolSlot,
    actions,
    configSchema,
    auto,
    reported,
    overValues,
    panels,
    writes,
    camera,
  ]);
}
