import type { Theme } from '@weasel-js/theme';
import { Component, type ReactNode } from 'react';
import { createKitRoot } from '../../kitIcons';
import type { Globals } from '../../protocol/messages';
import { loadIndexBundle, type Loaded } from '../../story/indexBundle';
import { isIndexId } from '../../story/indexPages';
import { LibrariesContext, type Library, librariesFrom } from '../../story/library';
import { loadStories } from '../../story/load';
import type { DepGraph, IndexEntry } from '../../story/types';
import type { CapturePayload } from '../../vite/capture/payload';
import type { FrameSetup } from '../FrameController';
import type { FrameImporters } from '../mountFrame';
import { CaptureView } from './CaptureView';

/** Inputs to `mountCapture`, as a capture page's entry module passes them. */
export interface MountCaptureOptions {
  index: readonly IndexEntry[];
  importers: FrameImporters;
  setup: FrameSetup;
  /** The shell config's `labTheme`; only the shell's capture page has one. */
  labTheme?: ((globals: Globals) => Theme) | undefined;
  /** The shell config's `libraries`, which an index page's header names and tints. */
  libraries?: readonly Library[] | undefined;
  /** The component graph an index page reads its dependencies and history from, asked for at its first capture. */
  dependencies?: (() => Promise<DepGraph>) | undefined;
}

declare global {
  interface Window {
    /** Set by `mountCapture`: renders one payload and resolves once it has painted. */
    __forgeCapture?: { render(payload: CapturePayload): Promise<void> };
  }
}

/** Catches what throws outside the story's own boundary, which would otherwise unmount the root and leave the
 *  render waiting forever. */
class CaptureBoundary extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * A capture page's entry: exposes `window.__forgeCapture.render(payload)`, which loads the payload's story, or the
 * index page its index id names, renders it afresh into `#root`, and resolves once it has painted. Rejects for an id
 * the index does not hold, and with whatever throws outside the story's own error boundary.
 */
export function mountCapture(options: MountCaptureOptions): void {
  const { index, importers, setup, labTheme } = options;
  const libraries = librariesFrom(options.libraries);
  const container = document.getElementById('root') ?? document.body;
  const root = createKitRoot(container, setup.icons);
  const prepared = new Map<string, Promise<Loaded>>();
  let graph: Promise<DepGraph | null> | null = null;
  let renders = 0;

  const importOf = (file: string): Promise<Record<string, unknown>> => {
    const importer = importers[file];
    return importer ? importer() : Promise.reject(new Error(`No importer for ${file}`));
  };
  const loadStory = async (id: string): Promise<Loaded> => {
    const entry = index.find((e) => e.id === id);
    if (!entry) throw new Error(`No story with id "${id}"`);
    const story = loadStories(await importOf(entry.file), entry.title, setup.parameters).find(
      (s) => s.exportName === entry.exportName,
    );
    if (!story) throw new Error(`${entry.file} has no story export "${entry.exportName}"`);
    await setup.prepare?.(story);
    return { kind: 'story', story };
  };
  const loadIndex = async (id: string): Promise<Loaded> => {
    const source = { index, importOf, parameters: setup.parameters, prepare: setup.prepare, libraries };
    return { kind: 'index', bundle: await loadIndexBundle(id, source) };
  };
  const subjectOf = (id: string): Promise<Loaded> => {
    let loading = prepared.get(id);
    if (!loading) {
      loading = isIndexId(id) ? loadIndex(id) : loadStory(id);
      prepared.set(id, loading);
      loading.catch(() => prepared.delete(id));
    }
    return loading;
  };
  // An index page without its graph still shows its stories; the screen shows it the same way until the graph lands.
  const graphOf = (): Promise<DepGraph | null> => {
    graph ??= options.dependencies ? options.dependencies().catch(() => null) : Promise.resolve(null);
    return graph;
  };

  window.__forgeCapture = {
    async render(payload) {
      const subject = await subjectOf(payload.story);
      const deps = subject.kind === 'index' ? await graphOf() : null;
      renders += 1;
      await new Promise<void>((resolve, reject) => {
        // Keyed per render, so a payload never inherits the last one's clock or state.
        root.render(
          <CaptureBoundary key={renders} onError={reject}>
            <LibrariesContext.Provider value={libraries}>
              <CaptureView
                subject={subject}
                graph={deps}
                payload={payload}
                setup={setup}
                labTheme={labTheme}
                onRendered={resolve}
              />
            </LibrariesContext.Provider>
          </CaptureBoundary>,
        );
      });
    },
  };
}
