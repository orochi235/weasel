import type { ClockRegistry } from '@weasel-js/clock';
import type { RecordCache } from '@weasel-js/storage';
import { type ReactNode, useState } from 'react';
import { AnnotationPreloadContext } from '../annotations/preload';
import { type CameraGestures, CameraGesturesContext } from '../canvas/cameraGestures';
import { CameraRegistryContext, createCameraRegistry } from '../canvas/cameraRegistry';
import { ClockRegistryContext } from '../clock/contexts';
import { PersistenceContext } from '../state/Persistence';
import { PresentationContext, type useLabPresentation } from './presentation';

/** Props for `LabRuntimeContexts`. */
export interface LabRuntimeContextsProps {
  records: RecordCache;
  /** The marks the lab's trials open on. */
  marks: ReadonlyMap<string, unknown>;
  presentation: ReturnType<typeof useLabPresentation>;
  gestures: CameraGestures | null;
  clocks: ClockRegistry;
  children: ReactNode;
}

/** What a running lab hands every trial inside it: its records, preloaded marks, presentation, cameras, camera
 *  gestures and clocks. The camera registry is made here, once for the lab's lifetime. */
export function LabRuntimeContexts({
  records,
  marks,
  presentation,
  gestures,
  clocks,
  children,
}: LabRuntimeContextsProps) {
  const [cameras] = useState(createCameraRegistry);
  return (
    <PersistenceContext.Provider value={records}>
      <AnnotationPreloadContext.Provider value={marks}>
        <PresentationContext.Provider value={presentation}>
          <CameraRegistryContext.Provider value={cameras}>
            <CameraGesturesContext.Provider value={gestures}>
              <ClockRegistryContext.Provider value={clocks}>
                {children}
              </ClockRegistryContext.Provider>
            </CameraGesturesContext.Provider>
          </CameraRegistryContext.Provider>
        </PresentationContext.Provider>
      </AnnotationPreloadContext.Provider>
    </PersistenceContext.Provider>
  );
}
