import { ShellDevtools } from '@weasel-js/devtools/mount';
import { isDev } from '@weasel-js/react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useStore } from 'zustand/react';
import { useShallow } from 'zustand/react/shallow';
import { useLabMarks } from '../annotations/labMarks';
import { useLabClocks } from '../clock/useLabClocks';
import type { InstrumentList } from '../instrument/types';
import type { LabMode } from '../state/types';
import { useOpenOnce, useWarnIgnoredChange } from '../state/useOpenOnce';
import { interstellarTheme } from '../theme/interstellar';
import { useLabFitWarning } from './fitCheck';
import { LabCommands } from './LabCommands';
import { trialIdsOf } from './LabContext';
import { LabPage, LabTheme } from './LabPage';
import { LabProviders } from './LabProviders';
import { LabRuntimeContexts } from './LabRuntimeContexts';
import { LabShell } from './LabShell';
import { useLabChromeAll } from './labChromeAll';
import type { LabBaseProps, LabProps } from './labProps';
import { type OpenedLab, openStoredLab, openUnstoredLab, presentStorageKey } from './openLab';
import {
  PresentationCommands,
  type PresentationStart,
  presentationStart,
  useLabPresentation,
} from './presentation';
import { useStoreCommands } from './storeCommands';
import { TriallessPage } from './TriallessPage';
import { TrialWorkspace } from './TrialWorkspace';
import { useTriallessHistory, withInstruments } from './trialless';
import { useFocusedTrial } from './useFocusPick';

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
  return (
    <LabTheme theme={theme} mode={mode ?? 'auto'} density={density} className="lk-lab">
      <LabShell
        title={title ?? 'Labkit'}
        mode={mode}
        {...(documentTitle !== undefined ? { documentTitle } : {})}
        {...(pages ? { pages } : {})}
        {...(path !== undefined ? { path } : {})}
      >
        {null}
      </LabShell>
    </LabTheme>
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
  return (
    <ShellDevtools devtools={props.devtools}>
      <LabRuntime {...props} opened={opened} start={start} />
    </ShellDevtools>
  );
}

let seedWarned = false;
function warnSeedIgnored(): void {
  if (seedWarned) return;
  seedWarned = true;
  console.warn('[labkit] <Lab> reads `seed` only when it starts presenting; it is ignored here');
}

/** Holds the store to `<Lab>`'s props: its instruments always, and its color mode whenever `mode` is given and
 *  changes. */
function useHeldProps(
  store: OpenedLab['store'],
  instruments: InstrumentList,
  mode: LabMode | undefined,
): void {
  // The store opened against the list <Lab> mounted with; a later list reaches
  // it here, before paint.
  useLayoutEffect(() => {
    store.getState().setInstruments(instruments);
  }, [instruments, store]);
  useEffect(() => {
    if (mode && mode !== store.getState().mode) store.getState().setMode(mode);
  }, [mode, store]);
}

function LabRuntime({
  instruments,
  mode,
  clock,
  chrome,
  labChrome,
  suppress,
  hide,
  sidebar,
  expandOnDoubleClick = false,
  addTrial,
  marks = true,
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
  ...page
}: ReturnType<typeof withInstruments> & { opened: OpenedLab; start: PresentationStart }) {
  const { store } = opened;
  useHeldProps(store, instruments, mode);

  const trialIds = useStore(store, useShallow(trialIdsOf));
  const clocks = useLabClocks(clock, opened.records);
  const modeValue = useStore(store, (s) => s.mode);
  const trialless = instruments.length === 0;
  const lone = useTriallessHistory(trialless, labChrome);

  const [labBody, setLabBody] = useState<HTMLDivElement | null>(null);
  useLabFitWarning(labBody);

  const { focusedTrialId, focus } = useFocusedTrial(labBody, store, trialIds);
  const options = { transport, messages };
  const presentation = useLabPresentation(start, focusedTrialId, labBody, clocks, store, options);

  const labMarks = useLabMarks(opened.records, marks);
  const chromeAll = useLabChromeAll(instruments, labMarks.shown, tools, lone.labChrome);

  const commands = useStoreCommands(store, {
    instruments,
    clocks,
    focusedTrialId,
    focus,
    configRules,
    renderers,
    marks: labMarks,
  });
  const addsTrial = !trialless && (addTrial ?? true);

  return (
    <LabProviders store={store} commands={commands} contextMenus={contextMenus} over={over}>
      <LabCommands contributions={chromeAll.all} addTrial={addsTrial} />
      <PresentationCommands presentation={presentation} />
      <LabRuntimeContexts
        records={opened.records}
        marks={opened.marks}
        presentation={presentation}
        gestures={gestures ?? null}
        clocks={clocks}
      >
        <LabPage
          {...page}
          mode={modeValue}
          presentation={presentation}
          chromeAll={chromeAll}
          addTrial={addsTrial}
          trialless={trialless}
          barChildren={children}
          bodyRef={setLabBody}
        >
          {trialless ? (
            <TriallessPage lone={lone}>{children}</TriallessPage>
          ) : (
            <TrialWorkspace
              store={store}
              ids={trialIds}
              expandOnDoubleClick={expandOnDoubleClick}
              trialOptions={{ chrome, suppress, hide, sidebar }}
            />
          )}
        </LabPage>
      </LabRuntimeContexts>
    </LabProviders>
  );
}
