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

/** A story file's name with its `.stories.tsx`-style suffix removed: `Bar` for `/x/Bar.stories.tsx`. */
function stemOf(file: string): string {
  const name = file.replaceAll('\\', '/').split('/').pop() ?? file;
  return name.replace(/(?:\.(?:story|stories))?\.[^.]+$/i, '');
}

/**
 * The file that speaks for a title several story files share: the one named for the title's last segment, so
 * `Bar.stories.tsx` over `lab/BarArc.stories.tsx` for `ui/Bar`, else the first. Its meta describes the component.
 */
export function primaryFile(title: string, files: readonly string[]): string | undefined {
  const name = (title.split('/').pop() ?? title).toLowerCase();
  return files.find((file) => stemOf(file).toLowerCase() === name) ?? files[0];
}

/** `stories` grouped by title, in the order titles first appear, each title's primary file's stories first. */
export function byComponent(stories: readonly IndexEntry[]): IndexEntry[] {
  const byTitle = new Map<string, IndexEntry[]>();
  for (const entry of stories) {
    const group = byTitle.get(entry.title);
    if (group) group.push(entry);
    else byTitle.set(entry.title, [entry]);
  }
  return [...byTitle].flatMap(([title, group]) => {
    const primary = primaryFile(title, [...new Set(group.map((entry) => entry.file))]);
    return [...group.filter((entry) => entry.file === primary), ...group.filter((entry) => entry.file !== primary)];
  });
}

/**
 * One index-page entry per title in `stories`, in the order titles first appear. It routes and runs like a story:
 * its `file` is the title's primary file, its descriptions are that file's, and its tags are those every story
 * of the title carries.
 */
export function indexEntries(stories: readonly IndexEntry[]): IndexEntry[] {
  const byTitle = new Map<string, IndexEntry>();
  for (const entry of byComponent(stories)) {
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
