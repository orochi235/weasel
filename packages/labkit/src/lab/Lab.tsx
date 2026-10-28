import { isDev } from '@weasel-js/react';
import { ThemeProvider, useResolvedColorMode } from '@weasel-js/theme/react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand/react';
import { useShallow } from 'zustand/react/shallow';
import { useLabMarks } from '../annotations/labMarks';
import { AnnotationPreloadContext } from '../annotations/preload';
import { CameraGesturesContext } from '../canvas/cameraGestures';
import { CameraRegistryContext, createCameraRegistry } from '../canvas/cameraRegistry';
import { LabFooterRegion, LabHeaderRegion } from '../chrome/LabChrome';
import { ClockRegistryContext } from '../clock/contexts';
import { useLabClocks } from '../clock/useLabClocks';
import { PersistenceContext } from '../state/Persistence';
import type { UndockedPanels } from '../state/undock';
import { useOpenOnce, useWarnIgnoredChange } from '../state/useOpenOnce';
import { interstellarTheme } from '../theme/interstellar';
import { Trial } from '../trial/Trial';
import { useLabFitWarning } from './fitCheck';
import { LabCommands } from './LabCommands';
import { trialIdsOf } from './LabContext';
import { LabHeader, LabThemeSwitcher } from './LabHeader';
import { LabMenuBar } from './LabMenuBar';
import { LabPalette } from './LabPalette';
import { LabPanes } from './LabPanes';
import { LabProviders } from './LabProviders';
import { LabShell } from './LabShell';
import { LabSurface } from './LabSurface';
import { LabZoom } from './LabZoom';
import { useLabChromeAll } from './labChromeAll';
import type { LabBaseProps, LabProps } from './labProps';
import { nebulaStyle } from './nebula';
import { type OpenedLab, openStoredLab, openUnstoredLab, presentStorageKey } from './openLab';
import { createPanelHostRegistry, PanelHostContext } from './panelHost';
import {
  labClassName,
  PresentationContext,
  type PresentationStart,
  presentationStart,
  useLabPresentation,
} from './presentation';
import { useStoreCommands } from './storeCommands';
import { UnreadableRecords } from './UnreadableRecords';
import { useFocusPick } from './useFocusPick';
import { type PanelDescriptor, type TrialLayout, Workspace } from './Workspace';

function LabFallback({
  title,
  mode,
  density,
  theme = interstellarTheme,
  pages,
  path,
  documentTitle,
}: Pick<
  LabBaseProps,
  'title' | 'documentTitle' | 'mode' | 'density' | 'theme' | 'pages' | 'path'
>) {
  const resolvedMode = useResolvedColorMode(mode ?? 'auto');
  return (
    <ThemeProvider
      theme={theme}
      selection={{ mode: resolvedMode, density: density ?? 'comfortable' }}
      className="lk-lab"
    >
      <LabShell
        title={title ?? 'Labkit'}
        mode={mode}
        {...(documentTitle !== undefined ? { documentTitle } : {})}
        {...(pages ? { pages } : {})}
        {...(path !== undefined ? { path } : {})}
      >
        {null}
      </LabShell>
    </ThemeProvider>
  );
}

/** The lab runtime: opens the store, provides it, and renders one trial
 *  per record in a grid. Each trial runs one of `instruments`. */
export function Lab(props: LabProps) {
  if (isDev() && props.instruments.length === 0) {
    throw new Error('[labkit] <Lab> requires a non-empty `instruments` array');
  }
  const { storageKey, storage, present, still, clock } = props;
  useWarnIgnoredChange('<Lab>', { storageKey, storage, present, still, clock });
  const [start] = useState(() => presentationStart(present, still));
  if (isDev() && props.seed && !start.presenting) {
    warnSeedIgnored();
  }
  const opened = useOpenOnce<OpenedLab>(() => {
    const seed = start.presenting ? (props.seed ?? {}) : undefined;
    // A still is the seed and nothing else, whoever's browser takes it.
    if (storageKey === undefined || start.still) return openUnstoredLab(props, seed);
    const key = start.presenting ? presentStorageKey(storageKey) : storageKey;
    return openStoredLab(props, key, storage, seed);
  });
  if (!opened) {
    if (props.fallback !== undefined) return props.fallback;
    // An embed shows nothing until its trial is ready, never the lab's shell.
    if (start.presenting) return null;
    return (
      <LabFallback
        title={props.title}
        {...(props.documentTitle !== undefined ? { documentTitle: props.documentTitle } : {})}
        mode={props.mode}
        density={props.density}
        {...(props.theme ? { theme: props.theme } : {})}
        pages={props.pages}
        path={props.path}
      />
    );
  }
  return <LabRuntime {...props} opened={opened} start={start} />;
}

function panelsOf(undocked: UndockedPanels): PanelDescriptor[] {
  return Object.entries(undocked).map(([key, panel]) => ({
    key,
    title: panel.sectionId,
    as: panel.as,
  }));
}

let seedWarned = false;
function warnSeedIgnored(): void {
  if (seedWarned) return;
  seedWarned = true;
  console.warn('[labkit] <Lab> reads `seed` only when it starts presenting; it is ignored here');
}

function LabRuntime({
  instruments,
  mode,
  density,
  theme = interstellarTheme,
  nebula,
  title,
  documentTitle,
  clock,
  pages,
  path,
  footer,
  chrome,
  labChrome,
  suppress,
  expandOnDoubleClick = false,
  addTrial,
  zoom = true,
  header = true,
  menus,
  menuBar = true,
  marks = true,
  contextMenus,
  tools,
  configRules,
  controls,
  gestures,
  transport = true,
  messages = true,
  children,
  opened,
  start,
}: LabProps & { opened: OpenedLab; start: PresentationStart }) {
  const { store } = opened;
  // The store opened against the list <Lab> mounted with; a later list reaches
  // it here, before paint.
  useLayoutEffect(() => {
    store.getState().setInstruments(instruments);
  }, [instruments, store]);

  const trialIds = useStore(store, useShallow(trialIdsOf));
  const [cameras] = useState(createCameraRegistry);
  const clocks = useLabClocks(clock, opened.records);
  const [focusPick, setFocusPick] = useState<string | null>(null);
  const focusedTrialId = trialIds.find((id) => id === focusPick) ?? trialIds[0] ?? null;
  const modeValue = useStore(store, (s) => s.mode);
  const layout = useStore(store, (s) => s.layout);
  const undockedPanels = useStore(store, (s) => s.undockedPanels);

  // One registry for the lab's lifetime: a panel host is a DOM node the workspace owns and the
  // trial portals into, so it must outlive both ends of a dock/undock without being rebuilt.
  const [panelHosts] = useState(createPanelHostRegistry);

  const [labBody, setLabBody] = useState<HTMLDivElement | null>(null);
  useLabFitWarning(labBody);

  useFocusPick(labBody, store, setFocusPick);
  const options = { transport, messages };
  const presentation = useLabPresentation(start, focusedTrialId, labBody, clocks, store, options);
  const presenting = presentation.active;
  const workspacePanels = useMemo(() => panelsOf(undockedPanels), [undockedPanels]);
  const resolvedMode = useResolvedColorMode(modeValue);

  const [marksShown, setMarksShown] = useLabMarks(opened.records, marks);
  const labChromeAll = useLabChromeAll(instruments, marksShown, tools, labChrome);
  const hasFooterChrome = labChromeAll.some((c) => c.region === 'footer');
  const hasPaneChrome = labChromeAll.some((c) => c.region === 'sidebar' || c.region === 'aside');

  useEffect(() => {
    if (mode && mode !== store.getState().mode) {
      store.getState().setMode(mode);
    }
  }, [mode, store]);

  const commands = useStoreCommands(store, {
    instruments,
    clocks,
    focusedTrialId,
    focus: setFocusPick,
    configRules,
    controls,
    marks: marksShown,
    setMarks: setMarksShown,
  });

  const backdropStyle = nebulaStyle(nebula, theme, resolvedMode, density ?? 'comfortable');

  const workspace = (
    <Workspace
      panels={workspacePanels}
      ids={trialIds}
      resizable
      reorderable
      onReorder={(ids) => commands.reorderTrials(ids)}
      layout={layout as TrialLayout}
      onLayoutChange={(next) => store.getState().setLayout(next)}
      expandOnDoubleClick={
        typeof expandOnDoubleClick === 'function'
          ? (id) => {
              const trial = store.getState().trials.find((t) => t.id === id);
              return trial ? expandOnDoubleClick(trial) : false;
            }
          : expandOnDoubleClick
      }
    >
      {trialIds.map((id) => (
        <Trial key={id} id={id} chrome={chrome} suppress={suppress} />
      ))}
    </Workspace>
  );

  return (
    <LabProviders store={store} commands={commands} contextMenus={contextMenus}>
      <LabCommands contributions={labChromeAll} addTrial={addTrial ?? true} />
      <PersistenceContext.Provider value={opened.records}>
        <AnnotationPreloadContext.Provider value={opened.marks}>
          <PresentationContext.Provider value={presentation}>
            <CameraRegistryContext.Provider value={cameras}>
              <CameraGesturesContext.Provider value={gestures ?? null}>
                <ClockRegistryContext.Provider value={clocks}>
                  <ThemeProvider
                    theme={theme}
                    selection={{ mode: resolvedMode, density: density ?? 'comfortable' }}
                    className={labClassName(presentation)}
                    style={backdropStyle}
                  >
                    <LabShell
                      title={title ?? 'Labkit'}
                      bar={header}
                      menuBar={
                        menuBar && !presenting ? (
                          <LabMenuBar
                            menus={menus}
                            contributions={labChromeAll}
                            addTrial={addTrial ?? true}
                            zoom={zoom}
                          />
                        ) : null
                      }
                      mode={modeValue}
                      {...(documentTitle !== undefined ? { documentTitle } : {})}
                      {...(pages ? { pages } : {})}
                      {...(path !== undefined ? { path } : {})}
                      footer={
                        hasFooterChrome ? (
                          <>
                            {footer}
                            <LabFooterRegion contributions={labChromeAll} />
                          </>
                        ) : (
                          footer
                        )
                      }
                      header={
                        header && (
                          <>
                            <LabHeader {...(addTrial !== undefined ? { addTrial } : {})} />
                            {zoom && !presenting ? <LabZoom /> : null}
                            {children}
                            <LabHeaderRegion contributions={labChromeAll} />
                            <LabThemeSwitcher />
                          </>
                        )
                      }
                    >
                      <UnreadableRecords />
                      <PanelHostContext.Provider value={panelHosts}>
                        <LabSurface bodyRef={setLabBody} contributions={labChromeAll}>
                          {hasPaneChrome ? (
                            <LabPanes contributions={labChromeAll}>
                              <LabPalette contributions={labChromeAll} />
                              {workspace}
                            </LabPanes>
                          ) : (
                            <>
                              <LabPalette contributions={labChromeAll} />
                              {workspace}
                            </>
                          )}
                        </LabSurface>
                      </PanelHostContext.Provider>
                    </LabShell>
                  </ThemeProvider>
                </ClockRegistryContext.Provider>
              </CameraGesturesContext.Provider>
            </CameraRegistryContext.Provider>
          </PresentationContext.Provider>
        </AnnotationPreloadContext.Provider>
      </PersistenceContext.Provider>
    </LabProviders>
  );
}
