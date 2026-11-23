import { loadCsfModule } from '../csf/loadCsfModule';
import { isNative } from './define';
import { loadNativeModule } from './native';
import type { IndexRender, LoadedStory } from './types';

/** Loads a story module's stories, as `loadStories` does. */
export type StoryLoader = (
  mod: Record<string, unknown>,
  title: string,
  parameters?: Record<string, unknown>,
  metaId?: string,
) => LoadedStory[];

/**
 * A story module's stories: a module whose default export is a forge `meta` is native, anything else is CSF under
 * `parameters`. `title` and `metaId` are the module's index entry's, which every story takes as given; its ids are
 * made from `metaId` where the meta names one, else from `title`.
 */
export const loadStories: StoryLoader = (mod, title, parameters, metaId) =>
  isNative(mod.default, 'meta') ? loadNativeModule(mod, title, metaId) : loadCsfModule(mod, title, parameters, metaId);

/** A module's own index page: a native meta's `index`, or a CSF meta's `parameters.forge.index`. */
export function indexRenderOf(mod: Record<string, unknown>): IndexRender | null {
  const meta = mod.default as { index?: unknown; parameters?: { forge?: { index?: unknown } } } | undefined;
  const render = isNative(meta, 'meta') ? meta?.index : meta?.parameters?.forge?.index;
  return typeof render === 'function' ? (render as IndexRender) : null;
}
