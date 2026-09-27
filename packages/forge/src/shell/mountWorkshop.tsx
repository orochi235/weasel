import { createRoot } from 'react-dom/client';
import type { FrameImporters } from '../frame/mountFrame';
import type { DepGraph, IndexEntry } from '../story/types';
import { createStoryChanges } from './storyChanges';
import { Workshop, type WorkshopProps } from './Workshop';

export interface MountWorkshopOptions extends WorkshopProps {
  /** Default: the document's `#root`. */
  container?: HTMLElement;
}

export interface MountedWorkshop {
  /** Swaps in a re-indexed story list, as the vite plugin's `forge:index` event carries. */
  setIndex(index: readonly IndexEntry[]): void;
  /** Swaps in importers whose URLs fetch the modules as they are now, after an edit. */
  setImporters(importers: FrameImporters): void;
  /** Loads `file` again for every story that had it, through the current importers. */
  reloadStory(file: string): void;
  /** Swaps in the component graph, as the vite plugin's `forge:deps` event carries. */
  setDependencies(dependencies: DepGraph): void;
  unmount(): void;
}

export function mountWorkshop({ container, ...props }: MountWorkshopOptions): MountedWorkshop {
  const target = container ?? document.getElementById('root');
  if (!target) throw new Error('mountWorkshop: no container given and no #root element');
  const root = createRoot(target);
  const changes = createStoryChanges();
  let current: WorkshopProps = { ...props, changes };
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
    unmount: () => root.unmount(),
  };
}
