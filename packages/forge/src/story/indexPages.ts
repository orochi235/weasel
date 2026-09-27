import { sanitize } from './ids';
import type { IndexEntry } from './types';

const SUFFIX = ':index';

/** The name an index page goes by in the sidebar and in its trial's title. */
export const INDEX_NAME = 'Index';

/** The id of `title`'s index page. A colon never survives `sanitize`, so no story id can collide with it. */
export function indexId(title: string): string {
  return `${sanitize(title)}${SUFFIX}`;
}

export function isIndexId(id: string): boolean {
  return id.endsWith(SUFFIX);
}

/**
 * One index-page entry per title in `stories`, in the order titles first appear. It routes and runs like a story:
 * its `file` is the title's first story file, its descriptions are the title's own, and its tags are those every story
 * of the title carries.
 */
export function indexEntries(stories: readonly IndexEntry[]): IndexEntry[] {
  const byTitle = new Map<string, IndexEntry>();
  for (const entry of stories) {
    const page = byTitle.get(entry.title);
    if (page) {
      if (page.tags) {
        const common = page.tags.filter((tag) => entry.tags?.includes(tag));
        if (common.length > 0) page.tags = common;
        else delete page.tags;
      }
      continue;
    }
    byTitle.set(entry.title, {
      id: indexId(entry.title),
      title: entry.title,
      name: INDEX_NAME,
      exportName: '',
      file: entry.file,
      ...(entry.componentDescription === undefined ? {} : { componentDescription: entry.componentDescription }),
      ...(entry.componentName === undefined ? {} : { componentName: entry.componentName }),
      ...(entry.tags === undefined ? {} : { tags: entry.tags }),
    });
  }
  return [...byTitle.values()];
}
