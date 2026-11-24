import { posixRelative } from './posixPath.ts';
import type { IndexEntry } from '../story/types';

/** A library whose stories are titled for the folder they sit in. Paths are relative to the repo root. */
export interface FolderTitleRule {
  /** The title's first segment: `'ui'`. */
  library: string;
  /** The package's source directory: `'packages/ui/src'`. */
  src: string;
  /** The directory under `src` holding one folder per component: `'components'`. */
  components: string;
}

/**
 * The titles a story file may take under `rule`, the folder it is titled for, and the title to suggest (`null` when
 * none fits the file's name), or `null` when the rule does not cover it. A story in a component folder is
 * `<library>/<folder>`, or `<library>/<folder>/<export>` for one of the names `exportsOf(folder)` returns; `<folder>`
 * is the path under `components`, two segments when the first is a lowercase group (`inspector/SelectionPanel`).
 * Outside a `lab/` directory the file is named for its title's last segment, ignoring case, an aspect after a dot
 * aside (`Slider.detents.stories.tsx`). A story elsewhere under `src` is titled for its directory.
 */
export function folderTitles(rel: string, rule: FolderTitleRule, exportsOf: (folder: string) => ReadonlySet<string>): { expected: string | null; folder: string; fits: (title: string) => boolean } | null {
  const prefix = `${rule.src}/`;
  if (!rel.startsWith(prefix)) return null;
  const parts = rel.slice(prefix.length).split('/');
  const dirs = parts.slice(0, -1);
  const name = parts[parts.length - 1]!.split('.')[0]!;
  if (dirs.length === 0) return null;
  if (dirs[0] !== rule.components) {
    const only = `${rule.library}/${dirs.join('/')}`;
    return { expected: only, folder: dirs.join('/'), fits: (title) => title === only };
  }
  const segs = dirs.slice(1);
  if (segs.length === 0) return null;
  const folder = /^[a-z]/.test(segs[0]!) ? segs.slice(0, 2) : segs.slice(0, 1);
  const lab = segs.slice(folder.length).join('/') === 'lab';
  const base = `${rule.library}/${folder.join('/')}`;
  const named = (segment: string) => name.toLowerCase() === segment.toLowerCase();
  const exported = exportsOf(folder.join('/'));
  const takesFolder = lab || named(folder[folder.length - 1]!);
  const match = [...exported].find(named);
  const expected = takesFolder ? base : match === undefined ? null : `${base}/${match}`;
  const fits = (title: string): boolean => {
    if (title === base) return takesFolder;
    if (!title.startsWith(`${base}/`)) return false;
    const last = title.slice(base.length + 1);
    return !last.includes('/') && exported.has(last) && (lab || named(last));
  };
  return { expected, folder: folder.join('/'), fits };
}

/** Each story file `folderTitles` covers whose title does not fit, with the title it should take. */
export function folderTitleReport(
  entries: readonly IndexEntry[],
  rule: FolderTitleRule,
  exportsOf: (folder: string) => ReadonlySet<string>,
  root: string,
): { lines: string[]; ok: boolean } {
  const under = (file: string) => posixRelative(root, file);
  const titles = new Map<string, string>();
  for (const entry of entries) if (!titles.has(under(entry.file))) titles.set(under(entry.file), entry.title);
  const wrong: [string, string, string][] = [];
  for (const [file, title] of titles) {
    const allowed = folderTitles(file, rule, exportsOf);
    if (allowed && !allowed.fits(title)) wrong.push([file, title, allowed.expected === null ? `no title fits: name the file for '${allowed.folder}' or one of its exports` : `'${allowed.expected}'`]);
  }
  const width = wrong.reduce((most, [file]) => Math.max(most, file.length), 0);
  const lines = wrong.map(([file, title, expected]) => `${file.padEnd(width)}  '${title}' → ${expected}`);
  if (wrong.length > 0) {
    lines.push(
      `${wrong.length} ${rule.library} story ${wrong.length === 1 ? 'file is' : 'files are'} not titled for ${wrong.length === 1 ? 'its' : 'their'} folder. A story in ${rule.src}/${rule.components}/<folder>/ is '${rule.library}/<folder>', or '${rule.library}/<folder>/<export>' for a name the folder exports, and its file is named for that last segment.`,
    );
  }
  return { lines, ok: wrong.length === 0 };
}
