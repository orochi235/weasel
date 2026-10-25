import { byComponent, indexId, isIndexId } from './indexPages';
import { type Libraries, TITLE_LIBRARIES } from './library';
import { indexRenderOf, loadStories } from './load';
import { taggedIds } from './tags';
import type { IndexRender, LoadedStory } from './types';

/** A component's index page as it loads: its stories in index order, and the page's own render. */
export interface IndexBundle {
  title: string;
  /** The package the component ships in. */
  library: string;
  description?: string;
  /** The tags every story of the component carries. */
  tags?: readonly string[];
  /** The ids of the stories tagged `gallery`. */
  galleries: readonly string[];
  /** The ids of the stories tagged `lab`. */
  labs: readonly string[];
  stories: readonly LoadedStory[];
  descriptions: Readonly<Record<string, string>>;
  render: IndexRender | null;
}

/** What a document has loaded for an entry: one story, or a component's index page. */
export type Loaded = { kind: 'story'; story: LoadedStory } | { kind: 'index'; bundle: IndexBundle };

/** One story as an index page's loader finds it. */
export interface BundleEntry {
  id: string;
  title: string;
  file: string;
  exportName: string;
  description?: string;
  componentDescription?: string;
  tags?: readonly string[];
}

/** Where `loadIndexBundle` reads a component's stories from. */
export interface IndexBundleSource {
  index: readonly BundleEntry[];
  /** The module of a story file; called once per file the component's stories live in. */
  importOf: (file: string) => Promise<Record<string, unknown>>;
  load?: ((mod: Record<string, unknown>, title: string, parameters?: Record<string, unknown>) => LoadedStory[]) | undefined;
  parameters?: Record<string, unknown> | undefined;
  prepare?: ((story: LoadedStory) => void | Promise<void>) | undefined;
  libraries?: Libraries | undefined;
}

const commonTags = (entries: readonly BundleEntry[]): string[] | undefined => {
  const [first, ...rest] = entries;
  const common = (first?.tags ?? []).filter((tag) => rest.every((e) => e.tags?.includes(tag)));
  return common.length > 0 ? common : undefined;
};

/**
 * The index page `id` names, loaded from every file its component's stories live in. Its description and library are
 * its primary file's. Rejects when no story of `index` belongs to the component.
 */
export async function loadIndexBundle(id: string, source: IndexBundleSource): Promise<IndexBundle> {
  const { importOf, load = loadStories, parameters, prepare, libraries = TITLE_LIBRARIES } = source;
  const entries = source.index.filter((e) => !isIndexId(e.id) && indexId(e.title) === id);
  const primary = byComponent(entries)[0];
  if (!primary) throw new Error(`No component with index "${id}"`);
  const { title } = primary;
  const files = [...new Set(entries.map((e) => e.file))];
  const mods = await Promise.all(files.map(importOf));
  const byFile = new Map(files.map((file, i) => [file, load(mods[i] ?? {}, title, parameters)]));
  const stories = entries.flatMap((e) => byFile.get(e.file)?.find((s) => s.exportName === e.exportName) ?? []);
  for (const story of stories) await prepare?.(story);
  const tags = commonTags(entries);
  return {
    title,
    library: libraries.of(primary),
    ...(primary.componentDescription === undefined ? {} : { description: primary.componentDescription }),
    ...(tags === undefined ? {} : { tags }),
    ...taggedIds(entries),
    stories,
    descriptions: Object.fromEntries(entries.flatMap((e) => (e.description ? [[e.id, e.description]] : []))),
    render: mods.map(indexRenderOf).find((render) => render !== null) ?? null,
  };
}
