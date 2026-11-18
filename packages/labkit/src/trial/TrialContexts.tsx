import type { createPointerStore } from '@weasel-js/core';
import {
  type ContextType,
  type MutableRefObject,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import type { CameraView } from '../canvas/CameraInput';
import { CameraWheelContext, type CameraWheelSlot } from '../canvas/CameraWheelContext';
import { CameraPublishContext, CameraRegistryContext } from '../canvas/cameraRegistry';
import { TrialClockContext, TrialRootContext } from '../clock/contexts';
import type { Instrument } from '../instrument/types';
import { TrialIdProvider, type TrialWriters } from '../state/context';
import { type LoupeSwitch, LoupeSwitchContext } from './loupeSwitch';
import { type TrialActions, TrialScope } from './TrialScope';
import { type MountedTrialHistory, TrialHistoryProvider } from './trialHistory';
import { TrialOrbitProvider } from './useOrbitView';
import type { TrialOrbit } from './useTrialOrbit';

/** Props for `TrialContexts`. */
export interface TrialContextsProps {
  trialId: string;
  /** The writes the trial's descendants make on it. */
  writes: TrialWriters;
  orbit: TrialOrbit | null;
  instrument: Instrument;
  clock: ContextType<typeof TrialClockContext>;
  root: MutableRefObject<HTMLElement | null>;
  /** The trial's marks, or null for an instrument that takes none. */
  annotations: ContextType<typeof AnnotationsContext>;
  children: ReactNode;
}

/** What a trial hands everything inside it, its chrome among them: its id and writes, orbit, clock, root element,
 *  marks, and the slot its camera's wheel binds through. */
export function TrialContexts({
  trialId,
  writes,
  orbit,
  instrument,
  clock,
  root,
  annotations,
  children,
}: TrialContextsProps) {
  const wheelSlot = useRef<CameraWheelSlot['current']>(null);
  return (
    <TrialIdProvider trialId={trialId} writes={writes}>
      <TrialOrbitProvider orbit={orbit} instrument={instrument} trialId={trialId}>
        <TrialClockContext.Provider value={clock}>
          <TrialRootContext.Provider value={root}>
            <AnnotationsContext.Provider value={annotations}>
              <CameraWheelContext.Provider value={wheelSlot}>
                {children}
              </CameraWheelContext.Provider>
            </AnnotationsContext.Provider>
          </TrialRootContext.Provider>
        </TrialClockContext.Provider>
      </TrialOrbitProvider>
    </TrialIdProvider>
  );
}

/** Props for `TrialBodyScope`. */
export interface TrialBodyScopeProps {
  trialId: string;
  pointer: ReturnType<typeof createPointerStore>;
  actions: TrialActions;
  loupeSwitch: LoupeSwitch;
  mounted: Pick<MountedTrialHistory, 'mount' | 'changes'>;
  children: ReactNode;
}

/** What a trial's body alone is rendered inside: its own scope, pointer store and actions, the publishing of the
 *  camera it last used, its loupe switch, and the history its instrument mounts. Chrome here reaches the camera last
 *  used. The pointer store is the trial's, shared by every camera. */
export function TrialBodyScope({
  trialId,
  pointer,
  actions,
  loupeSwitch,
  mounted,
  children,
}: TrialBodyScopeProps) {
  const cameras = useContext(CameraRegistryContext);
  const publishCamera = useMemo(
    () => (cameras ? (camera: CameraView) => cameras.register(trialId, camera) : null),
    [cameras, trialId],
  );
  return (
    <TrialScope pointer={pointer} actions={actions}>
      <CameraPublishContext.Provider value={publishCamera}>
        <LoupeSwitchContext.Provider value={loupeSwitch}>
          <TrialHistoryProvider mounted={mounted}>{children}</TrialHistoryProvider>
        </LoupeSwitchContext.Provider>
      </CameraPublishContext.Provider>
    </TrialScope>
  );
}
