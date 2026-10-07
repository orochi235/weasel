import { f } from '@weasel-js/labkit/config';
import { isNative } from './define';
import { storyId, storyNameFromExport } from './ids';
import { timelineOf } from '../timeline/declare';
import type { LoadedStory, MetaSpec, StorySpec } from './types';

/**
 * Normalizes a module written with `meta` and `story`; exports that are not stories are skipped. `title` is the index
 * entry's, which wins over the meta's own: the index reads the meta without running it and can miss it, so taking
 * the meta's here would give one story two titles.
 */
export function loadNativeModule(mod: Record<string, unknown>, title: string): LoadedStory[] {
  const metaSpec: MetaSpec = isNative(mod.default, 'meta') ? (mod.default as MetaSpec) : {};
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
      timeline: timelineOf(spec.timeline ?? metaSpec.timeline),
    });
  }
  return stories;
}
