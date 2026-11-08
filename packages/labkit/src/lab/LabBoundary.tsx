import { ThemeContext } from '@weasel-js/theme/react';
import { type Context, createElement, type ReactNode } from 'react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import { AnnotationPreloadContext } from '../annotations/preload';
import { CameraContext } from '../canvas/CameraInput';
import { CameraWheelContext } from '../canvas/CameraWheelContext';
import { CanvasStackContext } from '../canvas/CanvasStackContext';
import { CameraGesturesContext } from '../canvas/cameraGestures';
import { CameraPublishContext, CameraRegistryContext } from '../canvas/cameraRegistry';
import { ClockRegistryContext, TrialClockContext, TrialRootContext } from '../clock/contexts';
import { LabOverContext } from '../config/over';
import { LightboxContext } from '../lightbox/LightboxContext';
import { LightboxLayersContext } from '../lightbox/LightboxLayers';
import { LabStoreContext, TrialIdContext } from '../state/context';
import { PersistenceContext } from '../state/Persistence';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import { LoupeSwitchContext } from '../trial/loupeSwitch';
import { TrialDragContext } from '../trial/TrialDragContext';
import { TrialHistoryContext } from '../trial/trialHistory';
import { TrialTitleContext } from '../trial/trialTitle';
import { CameraMissingContext, OrbitViewContext } from '../trial/useOrbitView';
import { TrialOrbitContext } from '../trial/useTrialOrbit';
import { LabActionsContext } from './LabActions';
import { LabCommandsContext, LabContext } from './LabContext';
import { LabAmbientContext, LabEntriesContext } from './labAmbient';
import { LabContextMenusContext } from './labContextMenus';
import { PanelHostContext } from './panelHost';
import { PresentationContext } from './presentation';

type Absent = readonly [Context<never>, unknown];
const absent = <T,>(ctx: Context<T>, value: T): Absent => [ctx as unknown as Context<never>, value];

/** Each context a lab or a trial publishes, with what it reads as on a bare page. */
const ABSENT: readonly Absent[] = [
  absent(LabStoreContext, null),
  absent(PersistenceContext, null),
  absent(AnnotationPreloadContext, null),
  absent(LabContext, null),
  absent(LabCommandsContext, null),
  absent(LabOverContext, null),
  absent(LabActionsContext, false),
  absent(LabAmbientContext, null),
  absent(LabEntriesContext, new Map()),
  absent(LabContextMenusContext, null),
  absent(PresentationContext, null),
  absent(PanelHostContext, null),
  absent(SurfaceContext, null),
  absent(SurfaceCanvasContext, { over: null, under: null }),
  absent(LightboxContext, null),
  absent(LightboxLayersContext, { below: [], above: [] }),
  absent(ClockRegistryContext, null),
  absent(CameraRegistryContext, null),
  absent(CameraGesturesContext, null),
  absent(TrialIdContext, null),
  absent(TrialClockContext, null),
  absent(TrialRootContext, null),
  absent(TrialHistoryContext, null),
  absent(TrialTitleContext, null),
  absent(TrialOrbitContext, null),
  absent(OrbitViewContext, null),
  absent(CameraMissingContext, null),
  absent(LoupeSwitchContext, null),
  absent(AnnotationsContext, null),
  absent(CameraPublishContext, null),
  absent(CameraWheelContext, null),
  absent(CameraContext, null),
  absent(CanvasStackContext, null),
  absent(TrialDragContext, null),
  absent(ThemeContext, null),
];

/** Props for `<LabBoundary>`. */
export interface LabBoundaryProps {
  children: ReactNode;
}

/**
 * Renders its children as though no lab, trial or theme were above them: every context a `<Lab>` or a
 * `<Trial>` publishes reads as absent below it, so a labkit piece mounted inside a trial behaves the way it
 * does on a bare page. A `<LabRoot>` under it applies its own theme instead of deferring to the lab's, and a
 * `usePersistedState` under it keeps local state instead of writing into the enclosing lab's records.
 *
 * For a host that shows arbitrary content inside a trial, such as a component workshop; a lab's own chrome
 * never needs it.
 */
export function LabBoundary({ children }: LabBoundaryProps) {
  return ABSENT.reduceRight<ReactNode>(
    (inner, [ctx, value]) => createElement(ctx.Provider, { value: value as never }, inner),
    children,
  );
}
