import { createRoot } from 'react-dom/client';
import type { IndexEntry } from '../story/types';
import { Workshop, type WorkshopProps } from './Workshop';

export interface MountWorkshopOptions extends WorkshopProps {
  /** Default: the document's `#root`. */
  container?: HTMLElement;
}

export interface MountedWorkshop {
  /** Swaps in a re-indexed story list, as the vite plugin's `forge:index` event carries. */
  setIndex(index: readonly IndexEntry[]): void;
  unmount(): void;
}

export function mountWorkshop({ container, ...props }: MountWorkshopOptions): MountedWorkshop {
  const target = container ?? document.getElementById('root');
  if (!target) throw new Error('mountWorkshop: no container given and no #root element');
  const root = createRoot(target);
  let current: WorkshopProps = props;
  root.render(<Workshop {...current} />);
  return {
    setIndex(index) {
      current = { ...current, index };
      root.render(<Workshop {...current} />);
    },
    unmount: () => root.unmount(),
  };
}
