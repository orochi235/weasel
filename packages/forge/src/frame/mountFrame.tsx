import { loadCsfModule } from '../csf/loadCsfModule';
import { openChannel } from '../protocol/channel';
import { type FromFrame, PORT_HANDOFF, type ToFrame } from '../protocol/messages';
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

function waitForPort(): Promise<MessagePort> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown } | null;
      const port = event.ports[0];
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (typeof data !== 'object' || data === null || data.type !== PORT_HANDOFF || !port) return;
      window.removeEventListener('message', onMessage);
      resolve(port);
    };
    window.addEventListener('message', onMessage);
  });
}

/** The frame document's entry: takes the shell's port, loads the story named by the hash, and starts it. */
export async function mountFrame(options: MountFrameOptions): Promise<void> {
  const channel = openChannel<ToFrame, FromFrame>(await waitForPort());
  const id = location.hash.slice(1);
  try {
    const entry = options.index.find((e) => e.id === id);
    if (!entry) throw new Error(`No story with id "${id}"`);
    const importer = options.importers[entry.file];
    if (!importer) throw new Error(`No importer for ${entry.file}`);
    const mod = await importer();
    const stories = (options.load ?? loadStories)(mod, entry.title, options.setup?.parameters);
    const story = stories.find((s) => s.exportName === entry.exportName);
    if (!story) throw new Error(`${entry.file} has no story export "${entry.exportName}"`);
    startFrame({ story, channel, container: document.getElementById('root') ?? document.body, setup: options.setup });
  } catch (error) {
    reportImportFault(channel, error);
  }
}
