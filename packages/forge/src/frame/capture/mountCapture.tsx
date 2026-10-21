import type { Theme } from '@weasel-js/theme';
import { Component, type ReactNode } from 'react';
import { createKitRoot } from '../../kitIcons';
import type { Globals } from '../../protocol/messages';
import { loadStories } from '../../story/load';
import type { IndexEntry, LoadedStory } from '../../story/types';
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
 * A capture page's entry: exposes `window.__forgeCapture.render(payload)`, which loads the payload's story, renders
 * it afresh into `#root`, and resolves once it has painted. Rejects for a story the index does not hold, and with
 * whatever throws outside the story's own error boundary.
 */
export function mountCapture({ index, importers, setup, labTheme }: MountCaptureOptions): void {
  const container = document.getElementById('root') ?? document.body;
  const root = createKitRoot(container, setup.icons);
  const prepared = new Map<string, Promise<LoadedStory>>();
  let renders = 0;

  const storyOf = (id: string): Promise<LoadedStory> => {
    let loading = prepared.get(id);
    if (!loading) {
      loading = (async () => {
        const entry = index.find((e) => e.id === id);
        if (!entry) throw new Error(`No story with id "${id}"`);
        const importer = importers[entry.file];
        if (!importer) throw new Error(`No importer for ${entry.file}`);
        const story = loadStories(await importer(), entry.title, setup.parameters).find((s) => s.exportName === entry.exportName);
        if (!story) throw new Error(`${entry.file} has no story export "${entry.exportName}"`);
        await setup.prepare?.(story);
        return story;
      })();
      prepared.set(id, loading);
      loading.catch(() => prepared.delete(id));
    }
    return loading;
  };

  window.__forgeCapture = {
    async render(payload) {
      const story = await storyOf(payload.story);
      renders += 1;
      await new Promise<void>((resolve, reject) => {
        // Keyed per render, so a payload never inherits the last one's clock or state.
        root.render(
          <CaptureBoundary key={renders} onError={reject}>
            <CaptureView story={story} payload={payload} setup={setup} labTheme={labTheme} onRendered={resolve} />
          </CaptureBoundary>,
        );
      });
    },
  };
}
