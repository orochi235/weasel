import { globSync, readFileSync, statSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import type { Logger } from 'vite';
import { byComponent } from '../story/indexPages.ts';
import type { IndexEntry } from '../story/types.ts';
import type { ResolveImport } from './componentGraph.ts';
import { foreignCallees } from './indexFile.ts';
import { indexStory } from './indexStory.ts';
import { storyGlobOf } from './storyGlob.ts';
import { warnShared } from './titleReport.ts';
import { createWrapperResolver, sameResolution, type WrapperResolution } from './wrappers.ts';

/** What the story index reads from: the story globs, and the plugin's state, each read when it is needed. */
export interface StoryIndexOptions {
  /** Globs of story files, relative to the root. */
  stories: string[];
  root(): string;
  logger(): Logger | undefined;
  logError(err: unknown): void;
}

/** What an update did to the index: the new index, and whether the set of files with stories changed. */
export interface IndexUpdate {
  index: IndexEntry[];
  importablesChanged: boolean;
}

/** The story files, each read into its entries, kept current as files change. */
export interface StoryIndex {
  /** Story files, each with its entries; a file that failed to parse has none. */
  files(): Map<string, IndexEntry[]>;
  /** Every entry, ordered by component. */
  index(): IndexEntry[];
  /** The first pass deciding every story file's wrappers, run once before the index is first served. */
  settleAll(resolveImport: ResolveImport): Promise<void>;
  /** Re-reads a story file after `event`, and any story file whose meta or stories were resolved through it. */
  update(file: string, event: 'add' | 'change' | 'unlink', resolveImport: ResolveImport): Promise<IndexUpdate | null>;
  /** Forgets every file read, for a new root. */
  reset(): void;
}

/** Reads the story files `options.stories` matches into the index, on first use. */
export function createStoryIndex(options: StoryIndexOptions): StoryIndex {
  const { stories, root, logger, logError } = options;
  let byFile: Map<string, IndexEntry[]> | null = null;
  /** Per story file, which of its foreign callees are forge's `meta`/`story`, and what was read to decide it. */
  const wrappersOf = new Map<string, WrapperResolution>();
  let settledAll: Promise<void> | null = null;

  const glob = (): string[] => {
    const files = stories.flatMap((pattern) =>
      globSync(pattern, { cwd: root(), exclude: (name) => basename(String(name)) === 'node_modules' })
        .map((f) => resolve(root(), f))
        // A failed story run leaves `__screenshots__/<file>.stories.tsx/` directories that match the globs.
        .filter((f) => statSync(f).isFile())
        .sort(),
    );
    return [...new Set(files)];
  };
  const matches = (file: string): boolean => {
    const path = relative(root(), file).split(sep).join('/');
    return !path.split('/').includes('node_modules') && storyGlobOf(path, stories) !== undefined;
  };
  const read = (file: string) =>
    indexStory(readFileSync(file, 'utf8'), file, { root: root(), stories }, wrappersOf.get(file));
  /** A file that fails to parse stays in the map with no entries, so an edit that fixes it re-indexes it. */
  const files = (): Map<string, IndexEntry[]> => {
    byFile ??= new Map(
      glob().map((file) => {
        try {
          return [file, read(file)];
        } catch (err) {
          logError(err);
          return [file, []];
        }
      }),
    );
    return byFile;
  };
  const index = () => warnShared(byComponent([...files().values()].flat()), root(), logger());

  /**
   * Decides, for each of `targets`, which imports reached through another module are forge's `meta`/`story`, and
   * re-reads a file whose answer changed. Without it a meta imported from a project helper reads as no meta at all.
   */
  const settle = async (targets: readonly string[], resolveImport: ResolveImport): Promise<void> => {
    const decide = createWrapperResolver((file) => readFileSync(file, 'utf8'));
    const current = files();
    for (const file of targets) {
      if (!current.has(file)) continue;
      let next: WrapperResolution;
      try {
        next = await decide(file, foreignCallees(readFileSync(file, 'utf8'), file), resolveImport);
      } catch {
        // `read` has already logged a file that fails to parse.
        continue;
      }
      const before = wrappersOf.get(file);
      wrappersOf.set(file, next);
      if (sameResolution(before, next)) continue;
      try {
        current.set(file, read(file));
      } catch (err) {
        logError(err);
      }
    }
  };

  const update: StoryIndex['update'] = async (file, event, resolveImport) => {
    const current = files();
    const own = event === 'add' ? matches(file) : current.has(file);
    const through = [...wrappersOf]
      .filter(([story, { reads, unresolved }]) => story !== file && (reads.has(file) || (event === 'add' && unresolved)))
      .map(([story]) => story);
    if (!own && through.length === 0) return null;

    const before = JSON.stringify(index());
    const importable = () => JSON.stringify([...current].filter(([, entries]) => entries.length > 0).map(([path]) => path));
    const importableBefore = importable();
    if (own && event === 'unlink') {
      current.delete(file);
      wrappersOf.delete(file);
    } else if (own) {
      try {
        current.set(file, read(file));
      } catch (err) {
        logError(err);
        if (through.length === 0) return null;
      }
    }
    await settle([...(own && event !== 'unlink' ? [file] : []), ...through], resolveImport);
    const next = index();
    if (JSON.stringify(next) === before) return null;
    return { index: next, importablesChanged: importable() !== importableBefore };
  };

  return {
    files,
    index,
    settleAll: (resolveImport) => (settledAll ??= settle([...files().keys()], resolveImport)),
    update,
    reset() {
      byFile = null;
      wrappersOf.clear();
      settledAll = null;
    },
  };
}
