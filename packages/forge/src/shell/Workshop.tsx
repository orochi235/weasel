import {
  Lab,
  type LabContribution,
  type LabMenus,
  type StorageAdapter,
  useLabContext,
} from '@weasel-js/labkit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShellConfig } from '../config';
import { DEFAULT_TITLE } from '../title';
import type { FrameSetup } from '../frame/FrameController';
import type { FrameImporters } from '../frame/mountFrame';
import { type Globals, stableStringify } from '../protocol/messages';
import { indexEntries } from '../story/indexPages';
import { LibrariesContext, librariesFrom } from '../story/library';
import type { DepGraph, IndexEntry } from '../story/types';
import { DependenciesContext } from './dependencies';
import { missingInstrument } from './documentInstrument';
import { A11Y_SECTION } from './a11y/A11yPanel';
import { CssVarsChrome } from './cssVars/cssVarsChrome';
import { KeysChrome } from './keys/keysChrome';
import { infoItem } from './info/infoItem';
import { issuesSection } from './issues/IssuesPanel';
import { StoryInfoDialog } from './info/StoryInfoDialog';
import { createFramePool, type FramePool, FramePoolContext } from './framePool';
import { ForgeLoupe } from './loupe/ForgeLoupe';
import type { Revision } from './loupe/captureContext';
import { LoupeProvider } from './loupe/CaptureInputs';
import { createStoryHosts, StoryHostsContext } from './storyHosts';
import { createTrialFrames, TrialFramesContext } from './trialFrames';
import { RoutePlayhead } from '../timeline/RoutePlayhead';
import { type GlobalDeclarations, labGlobals } from './globals';
import { GlobalsToolbar, LabGlobals } from './GlobalsToolbar';
import { GlobalsMenus } from './globalsMenu';
import type { StoryChanges } from './storyChanges';
import { StoryGlobalsContext } from './StoryGlobalsContext';
import { LAB_DENSITY } from './labDensity';
import { RouteKnobs } from './RouteKnobs';
import { StoryTree } from './tree/StoryTree';
import { crossesInPlace, readRoute, readRouteEntry, useRoute } from './useRoute';
import { useStoryRegistry } from './useStoryRegistry';

/** Props for `Workshop`. `index`, `importers` and `dependencies` are what the vite plugin's virtual modules supply. */
export interface WorkshopProps {
  index: readonly IndexEntry[];
  /** The frame document, for the stories `isolate` keeps in one. */
  frameUrl: string;
  /** Story modules by file. Given, stories render in the workshop document; absent, every story renders in a frame. */
  importers?: FrameImporters;
  /** The frame config, applied to each story rendered in the document. */
  setup?: FrameSetup;
  /** Story files edited while the workshop runs; each is loaded again for the stories that had it. */
  changes?: StoryChanges;
  config?: ShellConfig;
  /** The story globs the index was built from, named when it is empty. */
  stories?: readonly string[];
  storageKey?: string;
  storage?: StorageAdapter;
  /** The component graph index pages list dependencies from. */
  dependencies?: DepGraph;
  /** The dev server's base, where it takes captures of a story; absent, lenses offer no Pixels source. */
  captureBase?: string;
  /** Bumped on every story edit, so no lens shows a capture of a story as it was. */
  revision?: Revision;
}

const NO_DECLARATIONS: GlobalDeclarations = {};

/**
 * Shows the story the route names when no trial shows it, once per route, so closing that trial sticks. It goes
 * into the trial the previous route was in when a history step crosses an in-place swap, so Back returns that
 * trial to its previous story; otherwise into the focused trial, as a click in the tree does. Only a lab with no
 * trial at all gets a new one: another trial is what Shift-click is for.
 */
function RouteOpener() {
  const lab = useLabContext();
  const [route] = useRoute();
  const handled = useRef<string | null>(null);
  const last = useRef({ route: readRoute(), entry: readRouteEntry() });
  useEffect(() => {
    const from = last.current;
    if (route !== from.route) last.current = { route, entry: readRouteEntry() };
    if (route === null || handled.current === route || !lab.instruments.some((i) => i.name === route)) return;
    handled.current = route;
    if (lab.trials.some((trial) => trial.instrumentName === route)) return;
    const previous = lab.trials.find((trial) => trial.instrumentName === from.route);
    const target =
      (previous && crossesInPlace(from.entry, last.current.entry) ? previous : undefined) ??
      lab.trials.find((trial) => trial.id === lab.focusedTrialId) ??
      lab.trials[0];
    if (target) lab.swapTrial(target.id, route);
    else lab.addTrial(route);
  }, [route, lab]);
  return null;
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** A pool of warm frames at `frameUrl` while `framed`; null otherwise. */
function useFramePool(frameUrl: string, framed: boolean): FramePool | null {
  const [pool, setPool] = useState<FramePool | null>(null);
  useEffect(() => {
    if (!framed) return;
    const next = createFramePool(frameUrl);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- publishes the frame pool this effect creates
    setPool(next);
    return () => {
      next.dispose();
      setPool(null);
    };
  }, [frameUrl, framed]);
  return pool;
}

/** What the workshop shows when the index is empty, naming the globs it was built from. */
function NoStories({ stories }: { stories: readonly string[] }) {
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

/** The workshop page: a labkit `Lab` with a story tree, where each story or index page opens as a trial. */
export function Workshop(props: WorkshopProps) {
  const { index, frameUrl, importers, setup, changes, config, stories = [], storageKey, storage, dependencies } = props;
  const declarations = config?.globals ?? NO_DECLARATIONS;
  const title = config?.title ?? DEFAULT_TITLE;
  useDocumentTitle(title);
  const [frames] = useState(createTrialFrames);
  const [hosts] = useState(createStoryHosts);
  // Warm frames are for the stories that render in one: every story when no importers are given, else the isolated.
  const pool = useFramePool(frameUrl, importers === undefined || index.some((entry) => entry.isolate !== undefined));
  const entries = useMemo(() => [...index, ...indexEntries(index)], [index]);
  const table = config?.libraries;
  const libraries = useMemo(() => librariesFrom(table), [table]);
  const registry = useStoryRegistry(entries, {
    frameUrl,
    globals: declarations,
    libraries,
    hosts,
    ...(importers ? { importers } : {}),
    ...(setup ? { setup } : {}),
  });
  // A route no story has gets an instrument of its own, so the trial it would open in says the story is missing.
  const [route] = useRoute();
  const missing = route !== null && !entries.some((entry) => entry.id === route) ? route : null;
  const instruments = useMemo(
    () => (missing === null ? registry.instruments : [...registry.instruments, missingInstrument(missing, declarations)]),
    [registry.instruments, missing, declarations],
  );
  const reload = registry.reload;
  useEffect(() => changes?.subscribe(reload), [changes, reload]);
  const [labValues, setLabValues] = useState<Globals>(() => labGlobals(declarations, undefined));
  const themeFor = config?.labTheme;
  const labTheme = useMemo(() => themeFor?.(labValues), [themeFor, labValues]);
  const [infoOpen, setInfoOpen] = useState(false);
  const reportLabValues = useCallback(
    (next: Globals) => setLabValues((prev) => (stableStringify(prev) === stableStringify(next) ? prev : next)),
    [],
  );
  const infoCommand = useMemo(() => infoItem(() => setInfoOpen(true)), []);
  const showsCssVars = config?.cssVars !== false;
  const modeGlobal = config?.loupe?.modeGlobal ?? 'mode';
  const [cssVarsChrome, setCssVarsChrome] = useState<readonly LabContribution[]>([]);
  const [keysChrome, setKeysChrome] = useState<readonly LabContribution[]>([]);
  const labChrome = useMemo<readonly LabContribution[]>(
    () => [
      { id: 'fg-stories', region: 'sidebar', render: (ctx) => <StoryTree ctx={ctx} index={index} /> },
      ...(showsCssVars ? cssVarsChrome : []),
      A11Y_SECTION,
      issuesSection(index),
      ...keysChrome,
      ...(Object.keys(declarations).length > 0
        ? [{ id: 'fg-globals', region: 'header', render: () => <GlobalsToolbar declarations={declarations} /> } as const]
        : []),
      { id: 'fg-info', region: 'header', group: 'story', item: infoCommand },
      { id: 'fg-loupe', region: 'overlay', render: () => <ForgeLoupe declarations={declarations} modeGlobal={modeGlobal} /> },
      ...(config?.labChrome ?? []),
    ],
    [index, infoCommand, declarations, showsCssVars, cssVarsChrome, keysChrome, config?.labChrome, modeGlobal],
  );
  const [menus, setMenus] = useState<LabMenus>();
  const first = index[0];
  if (!first) return <NoStories stories={stories} />;
  return (
    <LibrariesContext.Provider value={libraries}>
    <StoryGlobalsContext.Provider value={labValues}>
      <DependenciesContext.Provider value={dependencies ?? null}>
        <FramePoolContext.Provider value={pool}>
          <TrialFramesContext.Provider value={frames}>
            <StoryHostsContext.Provider value={hosts}>
            <LoupeProvider captureBase={props.captureBase} revision={props.revision}>
              <Lab
                title={title}
                density={LAB_DENSITY}
                {...(labTheme ? { theme: labTheme } : {})}
                instruments={instruments}
                defaultInstrument={readRoute() ?? first.id}
                storageKey={storageKey ?? 'weaselforge'}
                {...(storage ? { storage } : {})}
                labChrome={labChrome}
                addTrial={false}
                marks={false}
                {...(menus ? { menus } : {})}
                {...(config?.controls ? { controls: config.controls } : {})}
                {...(config?.pages ? { pages: config.pages } : {})}
                {...(config?.path !== undefined ? { path: config.path } : {})}
              >
                <RouteOpener />
                <RouteKnobs instruments={registry.instruments} isReady={registry.isReady} />
                <RoutePlayhead />
                <StoryInfoDialog
                  index={index}
                  isReady={registry.isReady}
                  isOpen={infoOpen}
                  onOpenChange={setInfoOpen}
                />
                <LabGlobals declarations={declarations} onChange={reportLabValues} />
                <GlobalsMenus declarations={declarations} onMenus={setMenus} />
                {showsCssVars ? <CssVarsChrome onChrome={setCssVarsChrome} /> : null}
                <KeysChrome onChrome={setKeysChrome} />
              </Lab>
            </LoupeProvider>
            </StoryHostsContext.Provider>
          </TrialFramesContext.Provider>
        </FramePoolContext.Provider>
      </DependenciesContext.Provider>
    </StoryGlobalsContext.Provider>
    </LibrariesContext.Provider>
  );
}
