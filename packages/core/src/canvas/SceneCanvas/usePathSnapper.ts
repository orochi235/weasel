import { useLayoutEffect, useMemo } from 'react';
import type { Scene } from 'core/scene/types';
import {
  createPathSnapper, type PathSnapOptions, type PathSnapper,
} from 'features/paths/pathSnap/pathSnapper';

/** The canvas's path snapper over `scene`, following `toolOptions.pathSnap`.
 *  Off while `options` is undefined. */
export function usePathSnapper(
  scene: Scene<unknown, string, unknown>,
  options: PathSnapOptions | undefined,
): PathSnapper {
  const snapper = useMemo(() => createPathSnapper(scene), [scene]);
  useLayoutEffect(() => {
    snapper.configure(options);
  }, [snapper, options]);
  return snapper;
}
