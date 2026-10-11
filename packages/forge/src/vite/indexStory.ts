import { readFileSync } from 'node:fs';
import type { IndexEntry } from '../story/types.ts';
import { autoTitle } from './autoTitle.ts';
import type { ResolveImport } from './depGraph.ts';
import { foreignCallees, indexFile } from './indexFile.ts';
import { createWrapperResolver, type WrapperResolution } from './wrappers.ts';

/** Where a project keeps its stories: the vite root, and the globs relative to it. */
export interface StorySource {
  root: string;
  stories: readonly string[];
}

/**
 * The stories `file` declares, titled as its place under `source` titles it. `wrappers` are the callees already
 * known to be forge's `meta` or `story` though imported from elsewhere; `indexStoryResolved` finds them.
 */
export function indexStory(code: string, file: string, source: StorySource, wrappers?: ReadonlySet<string>): IndexEntry[] {
  return indexFile(code, file, autoTitle(file, source.root, source.stories), wrappers);
}

/**
 * `indexStory`, after following the file's imports to decide which callees are forge's `meta` and `story`. Every
 * caller that indexes a file on its own goes through here, so a meta built by a project helper reads the same to
 * the workshop, to `forgeTest`, and to a script.
 */
export async function indexStoryResolved(
  code: string,
  file: string,
  source: StorySource,
  resolve: ResolveImport,
  decide = createWrapperResolver((path) => readFileSync(path, 'utf8')),
): Promise<{ entries: IndexEntry[]; resolution: WrapperResolution }> {
  const resolution = await decide(file, foreignCallees(code, file), resolve);
  return { entries: indexStory(code, file, source, resolution.wrappers), resolution };
}
