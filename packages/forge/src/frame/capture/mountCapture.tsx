import { createKitRoot } from '../../kitIcons';
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
}

declare global {
  interface Window {
    /** Set by `mountCapture`: renders one payload and resolves once it has painted. */
    __forgeCapture?: { render(payload: CapturePayload): Promise<void> };
  }
}

/**
 * A capture page's entry: exposes `window.__forgeCapture.render(payload)`, which loads the payload's story, renders
 * it afresh into `#root`, and resolves once it has painted. Rejects for a story the index does not hold.
 */
export function mountCapture({ index, importers, setup }: MountCaptureOptions): void {
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
      await new Promise<void>((resolve) => {
        // Keyed per render, so a payload never inherits the last one's clock or state.
        root.render(<CaptureView key={renders} story={story} payload={payload} setup={setup} onRendered={resolve} />);
      });
    },
  };
}
