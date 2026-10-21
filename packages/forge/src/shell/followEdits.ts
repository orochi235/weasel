import type { FrameImporters } from '../frame/mountFrame';
import type { DepGraph, IndexEntry } from '../story/types';
import type { MountedWorkshop } from './mountWorkshop';

/** The part of vite's `import.meta.hot` the workshop listens on. */
export interface HotEvents {
  on(event: string, listener: (data: never) => void): void;
}

/** What the shell entry hands an accepted importers module to. */
export interface FollowedEdits {
  importers(next: FrameImporters | undefined): void;
}

/**
 * Feeds the workshop what the vite plugin pushes after an edit. An edit to a story file, or to a module one imports,
 * reaches the page as an update of the importers module, whose fresh import() URLs carry the new timestamps; the files
 * it reaches arrive just before, so the reload waits for the importers that can fetch them. Any update at all, a
 * stylesheet's included, means a capture taken before it may show the story as it no longer is.
 */
export function followEdits(hot: HotEvents | undefined, workshop: MountedWorkshop): FollowedEdits {
  const stale = new Set<string>();
  hot?.on('forge:index', (next: readonly IndexEntry[]) => workshop.setIndex(next));
  hot?.on('forge:deps', (next: DepGraph) => workshop.setDependencies(next));
  hot?.on('forge:story', ({ file }: { file: string }) => {
    stale.add(file);
    workshop.revise();
  });
  hot?.on('vite:beforeUpdate', () => workshop.revise());
  return {
    importers(next) {
      if (!next) return;
      workshop.setImporters(next);
      for (const file of stale) workshop.reloadStory(file);
      stale.clear();
    },
  };
}
