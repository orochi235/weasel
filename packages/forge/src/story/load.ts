import { loadCsfModule } from '../csf/loadCsfModule';
import { isNative } from './define';
import { loadNativeModule } from './native';
import type { IndexRender, LoadedStory } from './types';

/**
 * A story module's stories: a module whose default export is a forge `meta` is native, anything else is CSF under
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

/** A module's own index page: a native meta's `index`, or a CSF meta's `parameters.forge.index`. */
export function indexRenderOf(mod: Record<string, unknown>): IndexRender | null {
  const meta = mod.default as { index?: unknown; parameters?: { forge?: { index?: unknown } } } | undefined;
  const render = isNative(meta, 'meta') ? meta?.index : meta?.parameters?.forge?.index;
  return typeof render === 'function' ? (render as IndexRender) : null;
}
