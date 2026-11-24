import { isIndexId } from '../story/indexPages';
import type { IndexEntry } from '../story/types';

/** One step of a story's place: its label, and the tree folder it names — null for the story itself. */
export interface Crumb {
  readonly label: string;
  readonly path: string | null;
}

const bare = (label: string): string => label.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Whether a story's name only restates its component's: `KeyDiagram` under `…/KeyDiagram`. */
export function restatesTitle(title: string, name: string): boolean {
  return bare(title.slice(title.lastIndexOf('/') + 1)) === bare(name);
}

/** A story's place step by step: each title segment, then the story's name. An `index` segment adds nothing the
 *  one before it does not already say, so it is left out, and so is a name that restates the last segment, which
 *  then stands for the story. A component's index page is the place its title names, with no step of its own. */
export function crumbs(entry: Pick<IndexEntry, 'id' | 'title' | 'name'>): Crumb[] {
  const { title, name } = entry;
  const segments = title.split('/');
  const steps: Crumb[] = segments
    .map((label, i) => ({ label, path: segments.slice(0, i + 1).join('/') }))
    .filter((step, i) => i === 0 || step.label.toLowerCase() !== 'index');
  if (isIndexId(entry.id)) return steps;
  if (restatesTitle(title, name) && steps.at(-1)!.path === title) steps[steps.length - 1] = { label: segments.at(-1)!, path: null };
  else steps.push({ label: name, path: null });
  return steps;
}

/** A story's place as one line. */
export function breadcrumb(entry: Pick<IndexEntry, 'id' | 'title' | 'name'>): string {
  return crumbs(entry)
    .map((step) => step.label)
    .join(' > ');
}
