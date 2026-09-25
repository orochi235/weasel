import { Lab, type LabContribution, type StorageAdapter, useLabContext } from '@weasel-js/labkit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShellConfig } from '../config';
import type { FrameSetup } from '../frame/FrameController';
import type { FrameImporters } from '../frame/mountFrame';
import { type Globals, stableStringify } from '../protocol/messages';
import { indexEntries } from '../story/indexPages';
import type { IndexEntry } from '../story/types';
import { InfoIcon } from '@weasel-js/ui';
import { A11Y_SECTION } from './a11y/A11yPanel';
import { CSS_VARS_SECTION } from './cssVars/CssVarsPanel';
import { StoryInfoDialog } from './info/StoryInfoDialog';
import { createFramePool, type FramePool, FramePoolContext } from './framePool';
import { createTrialFrames, TrialFramesContext } from './trialFrames';
import { type GlobalDeclarations, labGlobals } from './globals';
import { GlobalsToolbar, LabGlobals } from './GlobalsToolbar';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { StoryTree } from './tree/StoryTree';
import { crossesInPlace, readRoute, readRouteEntry, useRoute } from './useRoute';
import { useStoryRegistry } from './useStoryRegistry';

export interface WorkshopProps {
  index: readonly IndexEntry[];
  /** The frame document, for the stories `isolate` keeps in one. */
  frameUrl: string;
  /** Story modules by file. Given, stories render in the workshop document; absent, every story renders in a frame. */
  importers?: FrameImporters;
  /** The frame config, applied to each story rendered in the document. */
  setup?: FrameSetup;
  config?: ShellConfig;
  /** The story globs the index was built from, named when it is empty. */
  stories?: readonly string[];
  storageKey?: string;
  storage?: StorageAdapter;
}

const NO_DECLARATIONS: GlobalDeclarations = {};

/** The story or index page `#/<id>` names, when there is one; otherwise `fallback`. Read when the lab mounts. */
function initialStory(entries: readonly IndexEntry[], fallback: string): string {
  const route = readRoute();
  return route !== null && entries.some((entry) => entry.id === route) ? route : fallback;
}

/**
 * Opens a trial of the story the route names when none is open, once per route, so closing that trial sticks.
 * A history step across an in-place swap swaps back instead, so Back returns the trial to its previous story.
 */
function RouteOpener({ index }: { index: readonly IndexEntry[] }) {
  const lab = useLabContext();
  const [route] = useRoute();
  const handled = useRef<string | null>(null);
  const last = useRef({ route: readRoute(), entry: readRouteEntry() });
  useEffect(() => {
    const from = last.current;
    if (route !== from.route) last.current = { route, entry: readRouteEntry() };
    if (route === null || handled.current === route || !index.some((e) => e.id === route)) return;
    handled.current = route;
    if (lab.trials.some((trial) => trial.instrumentName === route)) return;
    const previous = lab.trials.find((trial) => trial.instrumentName === from.route);
    if (previous && crossesInPlace(from.entry, last.current.entry)) lab.swapTrial(previous.id, route);
    else lab.addTrial(route);
  }, [route, index, lab]);
  return null;
}

/**
 * Opens Get Info on ⌘I / Ctrl+I. `ToolItem.shortcut` is a tooltip hint —
 * labkit binds no keys — so the shell binds its own.
 */
function useInfoShortcut(open: (next: boolean) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'i' && event.key !== 'I') return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName ?? '')) return;
      event.preventDefault();
      open(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
}

export function Workshop({ index, frameUrl, importers, setup, config, stories = [], storageKey, storage }: WorkshopProps) {
  const declarations = config?.globals ?? NO_DECLARATIONS;
  const [frames] = useState(createTrialFrames);
  const [pool, setPool] = useState<FramePool | null>(null);
  // Warm frames are for the stories that render in one: every story when no importers are given, else the isolated.
  const framed = importers === undefined || index.some((entry) => entry.isolate !== undefined);
  useEffect(() => {
    if (!framed) return;
    const next = createFramePool(frameUrl);
    setPool(next);
    return () => {
      next.dispose();
      setPool(null);
    };
  }, [frameUrl, framed]);
  const entries = useMemo(() => [...index, ...indexEntries(index)], [index]);
  const registry = useStoryRegistry(entries, {
    frameUrl,
    globals: declarations,
    frames,
    ...(importers ? { importers } : {}),
    ...(setup ? { setup } : {}),
  });
  const [labValues, setLabValues] = useState<Globals>(() => labGlobals(declarations, undefined));
  const themeFor = config?.labTheme;
  const labTheme = useMemo(() => themeFor?.(labValues), [themeFor, labValues]);
  const [infoOpen, setInfoOpen] = useState(false);
  useInfoShortcut(setInfoOpen);
  const reportLabValues = useCallback(
    (next: Globals) => setLabValues((prev) => (stableStringify(prev) === stableStringify(next) ? prev : next)),
    [],
  );
  const labChrome = useMemo<readonly LabContribution[]>(
    () => [
      { id: 'fg-stories', region: 'sidebar', render: (ctx) => <StoryTree ctx={ctx} index={index} /> },
      {
        id: 'fg-info',
        region: 'palette',
        item: { icon: InfoIcon, label: 'Info', shortcut: '⌘I', onActivate: () => setInfoOpen(true) },
      },
      CSS_VARS_SECTION,
      A11Y_SECTION,
      ...(Object.keys(declarations).length > 0
        ? [{ id: 'fg-globals', region: 'header', render: () => <GlobalsToolbar declarations={declarations} /> } as const]
        : []),
      ...(config?.labChrome ?? []),
    ],
    [index, declarations, config?.labChrome],
  );
  const first = index[0];
  if (!first) {
    return (
      <div className="fg-empty">
        <p className="fg-empty__title">No stories found</p>
        {stories.length > 0 ? (
          <ul className="fg-empty__globs" aria-label="Story globs">
            {stories.map((glob) => (
              <li key={glob}>
                <code>{glob}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return (
    <StoryGlobalsContext.Provider value={labValues}>
      <FramePoolContext.Provider value={pool}>
        <TrialFramesContext.Provider value={frames}>
          <Lab
            title="weaselforge"
            density="roomy"
            {...(labTheme ? { theme: labTheme } : {})}
            instruments={registry.instruments}
            defaultInstrument={initialStory(entries, first.id)}
            storageKey={storageKey ?? 'weaselforge'}
            {...(storage ? { storage } : {})}
            labChrome={labChrome}
            addTrial={false}
            {...(config?.controls ? { controls: config.controls } : {})}
            {...(config?.pages ? { pages: config.pages } : {})}
            {...(config?.path !== undefined ? { path: config.path } : {})}
          >
            <RouteOpener index={entries} />
            <StoryInfoDialog
              index={index}
              isReady={registry.isReady}
              isOpen={infoOpen}
              onOpenChange={setInfoOpen}
            />
            <LabGlobals declarations={declarations} onChange={reportLabValues} />
          </Lab>
        </TrialFramesContext.Provider>
      </FramePoolContext.Provider>
    </StoryGlobalsContext.Provider>
  );
}
