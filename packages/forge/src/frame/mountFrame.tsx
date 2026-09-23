import { loadCsfModule } from '../csf/loadCsfModule';
import { openChannel } from '../protocol/channel';
import { FRAME_HELLO, type FromFrame, PORT_HANDOFF, type ToFrame } from '../protocol/messages';
import { isNative } from '../story/define';
import { loadNativeModule } from '../story/native';
import type { LoadedStory } from '../story/types';
import { type FrameSetup, reportImportFault, startFrame } from './FrameController';

export interface FrameImporters {
  [file: string]: () => Promise<Record<string, unknown>>;
}

export interface FrameIndexEntry {
  id: string;
  /** The story's title as indexed, which titles the file's stories when its meta names none. */
  title: string;
  file: string;
  exportName: string;
}

export interface MountFrameOptions {
  index: readonly FrameIndexEntry[];
  importers: FrameImporters;
  setup?: FrameSetup;
  load?: (mod: Record<string, unknown>, autoTitle: string, parameters?: Record<string, unknown>) => LoadedStory[];
}

/**
 * The default `load`: a module whose default export is a forge `meta` is native, anything else is CSF under
 * `parameters`. `autoTitle` titles the stories when the meta names no title.
 */
export function loadStories(
  mod: Record<string, unknown>,
  autoTitle: string,
  parameters?: Record<string, unknown>,
): LoadedStory[] {
  return isNative(mod.default, 'meta')
    ? loadNativeModule(mod, autoTitle)
    : loadCsfModule(mod, autoTitle, parameters);
}

function waitForHandoff(): Promise<{ port: MessagePort; id: string | null }> {
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
  const early = location.hash.slice(1) || null;
  const earlyEntry = early === null ? undefined : options.index.find((e) => e.id === early);
  // Only starts the fetch; whoever awaits the import later sees its outcome.
  if (earlyEntry && options.importers[earlyEntry.file]) importOf(earlyEntry.file).catch(() => {});

  const handoff = waitForHandoff();
  window.parent.postMessage({ type: FRAME_HELLO }, location.origin);
  const { port, id: handed } = await handoff;
  const channel = openChannel<ToFrame, FromFrame>(port);
  const id = handed ?? early ?? '';
  try {
    const entry = options.index.find((e) => e.id === id);
    if (!entry) throw new Error(`No story with id "${id}"`);
    const mod = await importOf(entry.file);
    const stories = (options.load ?? loadStories)(mod, entry.title, options.setup?.parameters);
    const story = stories.find((s) => s.exportName === entry.exportName);
    if (!story) throw new Error(`${entry.file} has no story export "${entry.exportName}"`);
    await options.setup?.prepare?.(story);
    startFrame({ story, channel, container: document.getElementById('root') ?? document.body, setup: options.setup });
  } catch (error) {
    reportImportFault(channel, error);
  }
}
