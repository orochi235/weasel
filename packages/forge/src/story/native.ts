import { f } from '@weasel-js/labkit/config';
import { isNative } from './define';
import { storyId, storyNameFromExport, titleFromFile } from './ids';
import type { LoadedStory, MetaSpec, StorySpec } from './types';

/** Normalizes a module written with `meta` and `story`; exports that are not stories are skipped. */
export function loadNativeModule(mod: Record<string, unknown>, file: string, root: string): LoadedStory[] {
  const metaSpec: MetaSpec = isNative(mod.default, 'meta') ? (mod.default as MetaSpec) : {};
  const title = metaSpec.title ?? titleFromFile(file, root);
  const stories: LoadedStory[] = [];
  for (const [exportName, value] of Object.entries(mod)) {
    if (exportName === 'default' || !isNative(value, 'story')) continue;
    const spec = value as StorySpec<unknown, unknown>;
    stories.push({
      id: storyId(title, exportName),
      title,
      name: spec.name ?? storyNameFromExport(exportName),
      exportName,
      config: spec.config ?? f.schema({}),
      initialState: spec.state ?? null,
      render: spec.render,
      decorators: [...(spec.decorators ?? []), ...(metaSpec.decorators ?? [])],
      layout: spec.layout ?? metaSpec.layout ?? 'centered',
      viewport: spec.viewport ?? null,
      play: spec.play ?? null,
    });
  }
  return stories;
}
