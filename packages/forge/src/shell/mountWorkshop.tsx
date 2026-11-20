import { createKitRoot } from '../kitIcons';
import type { FrameImporters } from '../frame/mountFrame';
import type { ComponentGraph, IndexEntry } from '../story/types';
import { createRevision, type Revision } from './loupe/captureContext';
import { createStoryChanges } from './storyChanges';
import { Workshop, type WorkshopProps } from './Workshop';

/** `Workshop`'s props, plus where to mount it. */
export interface MountWorkshopOptions extends WorkshopProps {
  /** Default: the document's `#root`. */
  container?: HTMLElement;
}

/** A mounted workshop, for feeding it what the vite plugin pushes after an edit. */
export interface MountedWorkshop {
  /** Swaps in a re-indexed story list, as the vite plugin's `forge:index` event carries. */
  setIndex(index: readonly IndexEntry[]): void;
  /** Swaps in importers whose URLs fetch the modules as they are now, after an edit. */
  setImporters(importers: FrameImporters): void;
  /** Loads `file` again for every story that had it, through the current importers. */
  reloadStory(file: string): void;
  /** Swaps in the component graph, as the vite plugin's `forge:deps` event carries. */
  setDependencies(dependencies: ComponentGraph): void;
  /** Says a story, or a module one imports, was edited: no lens shows a capture taken before it. */
  revise(): void;
  unmount(): void;
}

/** `own`'s count on top of `given`'s, heard when either moves: `revise` bumps the first, the caller the second. */
export function joinRevisions(own: Revision, given: Revision | undefined): Revision {
  if (!given) return own;
  return {
    get: () => own.get() + given.get(),
    subscribe(listener) {
      const offOwn = own.subscribe(listener);
      const offGiven = given.subscribe(listener);
      return () => {
        offOwn();
        offGiven();
      };
    },
  };
}

/**
 * Renders a `Workshop` into its own React root. A `changes` given is the one `reloadStory` emits on, and a `revision`
 * given counts toward the one `revise` bumps. Throws when no container is given and the page has no `#root`.
 */
export function mountWorkshop({ container, ...props }: MountWorkshopOptions): MountedWorkshop {
  const target = container ?? document.getElementById('root');
  if (!target) throw new Error('mountWorkshop: no container given and no #root element');
  const root = createKitRoot(target, props.setup?.icons);
  const changes = props.changes ?? createStoryChanges();
  const revision = createRevision();
  let current: WorkshopProps = { ...props, changes, revision: joinRevisions(revision, props.revision) };
  root.render(<Workshop {...current} />);
  return {
    setIndex(index) {
      current = { ...current, index };
      root.render(<Workshop {...current} />);
    },
    setImporters(importers) {
      current = { ...current, importers };
      root.render(<Workshop {...current} />);
    },
    reloadStory: (file) => changes.emit(file),
    setDependencies(dependencies) {
      current = { ...current, dependencies };
      root.render(<Workshop {...current} />);
    },
    revise: () => revision.bump(),
    unmount: () => root.unmount(),
  };
}
