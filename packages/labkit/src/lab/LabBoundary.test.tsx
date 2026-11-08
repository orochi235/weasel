import { render } from '@testing-library/react';
import type { RecordCache } from '@weasel-js/storage';
import { ThemeProvider, useThemeOptional } from '@weasel-js/theme/react';
import { type Context, use, useContext } from 'react';
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
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import { LoupeSwitchContext } from '../trial/loupeSwitch';
import { TrialDragContext } from '../trial/TrialDragContext';
import { TrialHistoryContext } from '../trial/trialHistory';
import { TrialTitleContext } from '../trial/trialTitle';
import { CameraMissingContext, OrbitViewContext } from '../trial/useOrbitView';
import { TrialOrbitContext } from '../trial/useTrialOrbit';
import { LabActionsContext } from './LabActions';
import { LabAmbientContext, LabEntriesContext } from './labAmbient';
import { LabContextMenusContext } from './labContextMenus';
import { PanelHostContext } from './panelHost';
import { PresentationContext } from './presentation';
import { describe, expect, it } from 'vitest';
import { LabStoreContext, LabStoreProvider, TrialIdContext } from '../state/context';
import { PersistenceContext } from '../state/Persistence';
import { createLabStore } from '../state/store';
import { interstellarTheme } from '../theme/interstellar';
import { LabBoundary } from './LabBoundary';
import { LabCommandsContext, LabContext, type LabContextValue } from './LabContext';
import { LabRoot } from './LabRoot';

function Probe() {
  const lab = useContext(LabContext);
  const store = useContext(LabStoreContext);
  const trial = useContext(TrialIdContext);
  const records = useContext(PersistenceContext);
  const theme = useThemeOptional();
  return (
    <output>
      {JSON.stringify({
        lab: lab !== null,
        store: store !== null,
        trial,
        records: records !== null,
        theme: theme !== null,
      })}
    </output>
  );
}

const fakeLab = { trials: [], instruments: [] } as unknown as LabContextValue;

describe('LabBoundary', () => {
  it('hides the enclosing lab, trial, records and theme from its children', () => {
    const { container } = render(
      <ThemeProvider theme={interstellarTheme} selection={{ mode: 'dark' }}>
        <LabStoreProvider store={createLabStore({})}>
          <PersistenceContext.Provider value={{} as RecordCache}>
            <LabContext.Provider value={fakeLab}>
              <TrialIdContext.Provider value="t1">
                <Probe />
                <LabBoundary>
                  <Probe />
                </LabBoundary>
              </TrialIdContext.Provider>
            </LabContext.Provider>
          </PersistenceContext.Provider>
        </LabStoreProvider>
      </ThemeProvider>,
    );
    const [outside, inside] = Array.from(container.querySelectorAll('output')).map((el) =>
      JSON.parse(el.textContent ?? ''),
    );
    expect(outside).toEqual({ lab: true, store: true, trial: 't1', records: true, theme: true });
    expect(inside).toEqual({ lab: false, store: false, trial: null, records: false, theme: false });
  });

  it('lets a LabRoot under it apply its own theme instead of deferring to the one above', () => {
    const { container } = render(
      <ThemeProvider theme={interstellarTheme} selection={{ mode: 'dark' }}>
        <LabBoundary>
          <LabRoot mode="light">x</LabRoot>
        </LabBoundary>
      </ThemeProvider>,
    );
    const themed = container.querySelectorAll('[data-wzl-theme]');
    expect(themed).toHaveLength(2);
    expect(themed[1]?.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('hides every context a lab or a trial publishes', () => {
    const published: Record<string, Context<never>> = {
      AnnotationPreloadContext,
      AnnotationsContext,
      CameraContext,
      CameraGesturesContext,
      CameraMissingContext,
      CameraPublishContext,
      CameraRegistryContext,
      CameraWheelContext,
      CanvasStackContext,
      ClockRegistryContext,
      LabActionsContext,
      LabAmbientContext,
      LabCommandsContext,
      LabContext,
      LabContextMenusContext,
      LabEntriesContext,
      LabOverContext,
      LabStoreContext,
      LightboxContext,
      LightboxLayersContext,
      LoupeSwitchContext,
      OrbitViewContext,
      PanelHostContext,
      PersistenceContext,
      PresentationContext,
      SurfaceCanvasContext,
      SurfaceContext,
      TrialClockContext,
      TrialDragContext,
      TrialHistoryContext,
      TrialIdContext,
      TrialOrbitContext,
      TrialRootContext,
      TrialTitleContext,
    } as unknown as Record<string, Context<never>>;
    const sentinel = { sentinel: true } as never;
    const seen: string[] = [];
    function Read() {
      for (const [name, ctx] of Object.entries(published)) {
        if (use(ctx) === sentinel) seen.push(name);
      }
      return null;
    }
    const tree = Object.values(published).reduceRight(
      (inner, Ctx) => <Ctx.Provider value={sentinel}>{inner}</Ctx.Provider>,
      <LabBoundary>
        <Read />
      </LabBoundary>,
    );
    render(tree);
    expect(seen).toEqual([]);
  });
});
