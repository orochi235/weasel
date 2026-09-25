import { openChannel } from '../protocol/channel';
import { FRAME_HELLO, type FromFrame, PORT_HANDOFF, type ToFrame } from '../protocol/messages';
import { indexId, isIndexId } from '../story/indexPages';
import { indexRenderOf, loadStories } from '../story/load';
import type { LoadedStory } from '../story/types';
import { type FrameSetup, reportImportFault, startFrame } from './FrameController';
import { startIndex } from './index/startIndex';

export interface FrameImporters {
  [file: string]: () => Promise<Record<string, unknown>>;
}

export interface FrameIndexEntry {
  id: string;
  /** The story's title as indexed, which titles the file's stories when its meta names none. */
  title: string;
  file: string;
  exportName: string;
  /** The JSDoc above the story's export, which its index page shows. */
  description?: string;
  /** The JSDoc above the file's meta, which heads the index page. */
  componentDescription?: string;
}

export interface MountFrameOptions {
  index: readonly FrameIndexEntry[];
  importers: FrameImporters;
  setup?: FrameSetup;
  load?: (mod: Record<string, unknown>, autoTitle: string, parameters?: Record<string, unknown>) => LoadedStory[];
}

export { indexRenderOf, loadStories } from '../story/load';

function waitForHandoff():Promise<{ port: MessagePort; id: string | null }> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; id?: unknown } | null;
      const port = event.ports[0];
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (typeof data !== 'object' || data === null || data.type !== PORT_HANDOFF || !port) return;
      window.removeEventListener('message', onMessage);
      resolve({ port, id: typeof data.id === 'string' ? data.id : null });
    };
    window.addEventListener('message', onMessage);
  });
}

/**
 * The frame document's entry: asks its parent for a port and shows what the handoff names, or, from a shell that
 * names nothing, what the hash does. The hash is read at once, so its module loads during the handshake.
 */
export async function mountFrame(options: MountFrameOptions): Promise<void> {
  const imports = new Map<string, Promise<Record<string, unknown>>>();
  const importOf = (file: string): Promise<Record<string, unknown>> => {
    let loading = imports.get(file);
    if (!loading) {
      const importer = options.importers[file];
      if (!importer) throw new Error(`No importer for ${file}`);
      loading = importer();
      imports.set(file, loading);
    }
    return loading;
  };
  /** The entries `id` shows: one story, or every story of the component an index id names. */
  const entriesOf = (id: string): FrameIndexEntry[] =>
    isIndexId(id)
      ? options.index.filter((e) => indexId(e.title) === id)
      : options.index.filter((e) => e.id === id);
  const early = location.hash.slice(1) || null;
  // Only starts the fetch; whoever awaits the import later sees its outcome.
  for (const file of new Set(early === null ? [] : entriesOf(early).map((e) => e.file))) {
    if (options.importers[file]) importOf(file).catch(() => {});
  }

  const handoff = waitForHandoff();
  window.parent.postMessage({ type: FRAME_HELLO }, location.origin);
  const { port, id: handed } = await handoff;
  const channel = openChannel<ToFrame, FromFrame>(port);
  const id = handed ?? early ?? '';
  const container = document.getElementById('root') ?? document.body;
  try {
    if (isIndexId(id)) {
      const entries = entriesOf(id);
      const title = entries[0]?.title;
      if (title === undefined) throw new Error(`No component with index "${id}"`);
      const files = [...new Set(entries.map((e) => e.file))];
      const mods = await Promise.all(files.map(importOf));
      const loaded = files.map((file, i) => ({
        file,
        stories: (options.load ?? loadStories)(mods[i] ?? {}, title, options.setup?.parameters),
      }));
      const stories = entries.flatMap(
        (e) => loaded.find((l) => l.file === e.file)?.stories.find((s) => s.exportName === e.exportName) ?? [],
      );
      for (const story of stories) await options.setup?.prepare?.(story);
      startIndex({
        title,
        ...(entries[0]?.componentDescription === undefined ? {} : { description: entries[0].componentDescription }),
        stories,
        descriptions: Object.fromEntries(entries.flatMap((e) => (e.description ? [[e.id, e.description]] : []))),
        render: mods.map(indexRenderOf).find((render) => render !== null) ?? null,
        channel,
        container,
        ...(options.setup ? { setup: options.setup } : {}),
      });
      return;
    }
    const entry = options.index.find((e) => e.id === id);
    if (!entry) throw new Error(`No story with id "${id}"`);
    const mod = await importOf(entry.file);
    const stories = (options.load ?? loadStories)(mod, entry.title, options.setup?.parameters);
    const story = stories.find((s) => s.exportName === entry.exportName);
    if (!story) throw new Error(`${entry.file} has no story export "${entry.exportName}"`);
    await options.setup?.prepare?.(story);
    startFrame({ story, channel, container, setup: options.setup });
  } catch (error) {
    reportImportFault(channel, error);
  }
}
