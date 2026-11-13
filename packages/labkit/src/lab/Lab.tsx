import { isDev } from '@weasel-js/react';
import { ThemeProvider, useResolvedColorMode } from '@weasel-js/theme/react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useStore } from 'zustand/react';
import { useShallow } from 'zustand/react/shallow';
import { AnnotationOptions } from '../annotations/AnnotationOptions';
import { useLabMarks } from '../annotations/labMarks';
import { AnnotationPreloadContext } from '../annotations/preload';
import { CameraGesturesContext } from '../canvas/cameraGestures';
import { CameraRegistryContext, createCameraRegistry } from '../canvas/cameraRegistry';
import { LabFooterRegion } from '../chrome/LabChrome';
import { ClockRegistryContext } from '../clock/contexts';
import { useLabClocks } from '../clock/useLabClocks';
import { PersistenceContext } from '../state/Persistence';
import type { LabMode } from '../state/types';
import { useOpenOnce, useWarnIgnoredChange } from '../state/useOpenOnce';
import { interstellarTheme } from '../theme/interstellar';
import { TrialHistoryContext } from '../trial/trialHistory';
import { useLabFitWarning } from './fitCheck';
import { LabCommands } from './LabCommands';
import { trialIdsOf } from './LabContext';
import { labBar } from './LabHeader';
import { LabPalette } from './LabPalette';
import { LabPanes } from './LabPanes';
import { LabProviders } from './LabProviders';
import { LabShell } from './LabShell';
import { LabShortcutSheet } from './LabShortcutSheet';
import { LabSurface } from './LabSurface';
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
import { TrialWorkspace } from './TrialWorkspace';
import { useTriallessHistory, withInstruments } from './trialless';
import { UnreadableRecords } from './UnreadableRecords';
import { useFocusPick } from './useFocusPick';

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
 *  per record in a grid. Each trial runs one of `instruments`; with none, the
 *  lab has no trials and renders its `children` as the body. */
export function Lab(given: LabProps) {
  const props = withInstruments(given);
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

let seedWarned = false;
function warnSeedIgnored(): void {
  if (seedWarned) return;
  seedWarned = true;
  console.warn('[labkit] <Lab> reads `seed` only when it starts presenting; it is ignored here');
}

/** Holds the store's color mode to the `mode` prop whenever the prop is given and changes. */
function useModeProp(mode: LabMode | undefined, store: OpenedLab['store']) {
  useEffect(() => {
    if (mode && mode !== store.getState().mode) store.getState().setMode(mode);
  }, [mode, store]);
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
  hide,
  sidebar,
  expandOnDoubleClick = false,
  addTrial,
  zoom = true,
  header = true,
  menus,
  menuBar = true,
  marks = true,
  shortcuts = true,
  contextMenus,
  tools,
  configRules,
  renderers,
  over,
  gestures,
  transport = true,
  messages = true,
  children,
  opened,
  start,
}: ReturnType<typeof withInstruments> & { opened: OpenedLab; start: PresentationStart }) {
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
  const trialless = instruments.length === 0;
  const lone = useTriallessHistory(trialless, labChrome);

  // One registry for the lab's lifetime: a panel host is a DOM node the workspace owns and the
  // trial portals into, so it must outlive both ends of a dock/undock without being rebuilt.
  const [panelHosts] = useState(createPanelHostRegistry);

  const [labBody, setLabBody] = useState<HTMLDivElement | null>(null);
  useLabFitWarning(labBody);

  useFocusPick(labBody, store, setFocusPick);
  const options = { transport, messages };
  const presentation = useLabPresentation(start, focusedTrialId, labBody, clocks, store, options);
  const resolvedMode = useResolvedColorMode(modeValue);

  const labMarks = useLabMarks(opened.records, marks);
  const chromeAll = useLabChromeAll(instruments, labMarks.shown, tools, lone.labChrome);
  const labChromeAll = chromeAll.all;

  useModeProp(mode, store);

  const commands = useStoreCommands(store, {
    instruments,
    clocks,
    focusedTrialId,
    focus: setFocusPick,
    configRules,
    renderers,
    marks: labMarks,
  });

  const bar = labBar({
    header,
    menuBar,
    presenting: presentation.active,
    menus,
    zoom: zoom && !trialless,
    children: trialless ? undefined : children,
    addTrial: !trialless && (addTrial ?? true),
    contributions: labChromeAll,
    shortcuts,
  });
  const backdropStyle = nebulaStyle(nebula, theme, resolvedMode, density ?? 'comfortable');

  const body = trialless ? (
    <TrialHistoryContext.Provider value={lone.mount}>
      <div className="lk-lab__page">{children}</div>
    </TrialHistoryContext.Provider>
  ) : (
    <TrialWorkspace
      store={store}
      ids={trialIds}
      expandOnDoubleClick={expandOnDoubleClick}
      trialOptions={{ chrome, suppress, hide, sidebar }}
    />
  );

  return (
    <LabProviders store={store} commands={commands} contextMenus={contextMenus} over={over}>
      <LabCommands contributions={labChromeAll} addTrial={!trialless && (addTrial ?? true)} />
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
                      menuBar={bar.menuBar}
                      mode={modeValue}
                      {...(documentTitle !== undefined ? { documentTitle } : {})}
                      {...(pages ? { pages } : {})}
                      {...(path !== undefined ? { path } : {})}
                      footer={
                        chromeAll.hasFooter ? (
                          <>
                            {footer}
                            <LabFooterRegion contributions={labChromeAll} />
                          </>
                        ) : (
                          footer
                        )
                      }
                      header={bar.header}
                    >
                      <UnreadableRecords />
                      {shortcuts && <LabShortcutSheet tools={chromeAll.tools} />}
                      <PanelHostContext.Provider value={panelHosts}>
                        <LabSurface bodyRef={setLabBody} contributions={labChromeAll}>
                          <AnnotationOptions tools={chromeAll.tools} />
                          {chromeAll.hasPanes ? (
                            <LabPanes contributions={labChromeAll}>
                              <LabPalette contributions={labChromeAll} />
                              {body}
                            </LabPanes>
                          ) : (
                            <>
                              <LabPalette contributions={labChromeAll} />
                              {body}
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
