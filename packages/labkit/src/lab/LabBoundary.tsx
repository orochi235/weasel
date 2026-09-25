import { ThemeContext } from '@weasel-js/theme/react';
import type { ReactNode } from 'react';
import { AnnotationsContext } from '../annotations/AnnotationsContext';
import { AnnotationPreloadContext } from '../annotations/preload';
import { CameraWheelContext } from '../canvas/CameraWheelContext';
import { CanvasStackContext } from '../canvas/CanvasStackContext';
import { LabStoreContext, TrialIdContext } from '../state/context';
import { PersistenceContext } from '../state/Persistence';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import { TrialDragContext } from '../trial/TrialDragContext';
import { LabContext } from './LabContext';
import { PanelHostContext } from './panelHost';

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
  return (
    <LabStoreContext.Provider value={null}>
      <PersistenceContext.Provider value={null}>
        <AnnotationPreloadContext.Provider value={null}>
          <LabContext.Provider value={null}>
            <PanelHostContext.Provider value={null}>
              <SurfaceContext.Provider value={null}>
                <SurfaceCanvasContext.Provider value={{ over: null, under: null }}>
                  <TrialIdContext.Provider value={null}>
                    <AnnotationsContext.Provider value={null}>
                      <CameraWheelContext.Provider value={null}>
                        <CanvasStackContext.Provider value={null}>
                          <TrialDragContext.Provider value={null}>
                            <ThemeContext.Provider value={null}>{children}</ThemeContext.Provider>
                          </TrialDragContext.Provider>
                        </CanvasStackContext.Provider>
                      </CameraWheelContext.Provider>
                    </AnnotationsContext.Provider>
                  </TrialIdContext.Provider>
                </SurfaceCanvasContext.Provider>
              </SurfaceContext.Provider>
            </PanelHostContext.Provider>
          </LabContext.Provider>
        </AnnotationPreloadContext.Provider>
      </PersistenceContext.Provider>
    </LabStoreContext.Provider>
  );
}
