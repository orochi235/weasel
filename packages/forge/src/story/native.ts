import { f } from '@weasel-js/labkit/config';
import { isNative } from './define';
import { storyId, storyNameFromExport } from './ids';
import type { LoadedStory, MetaSpec, StorySpec } from './types';

/** Normalizes a module written with `meta` and `story`; exports that are not stories are skipped. */
/** `autoTitle` titles the stories when the meta names no title. */
export function loadNativeModule(mod: Record<string, unknown>, autoTitle: string): LoadedStory[] {
  const metaSpec: MetaSpec = isNative(mod.default, 'meta') ? (mod.default as MetaSpec) : {};
  const title = metaSpec.title ?? autoTitle;
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
      isolate: spec.isolate ?? metaSpec.isolate ?? null,
      play: spec.play ?? null,
    });
  }
  return stories;
}
