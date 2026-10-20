import { buildSceneViewCommands, defaultDrawOne, type RenderLayer } from '@weasel-js/core';
import { usePaperLayer, useSinglePage, type PageSize } from '@editor/index';
import { useMemo } from 'react';
import type { DrawScene } from './drawDocument';

/** What the loupe magnifies: the page and the scene on top of it. The scene half projects inside
 *  `buildSceneViewCommands`, which is what `space: 'screen'` says about it. */
export function useLoupeSource(scene: DrawScene, page: PageSize, backgroundColor: string): RenderLayer<unknown>[] {
  const paperLayer = usePaperLayer(useSinglePage(page), backgroundColor);
  return useMemo<RenderLayer<unknown>[]>(() => [
    paperLayer,
    {
      id: 'loupe-scene',
      label: 'Loupe scene',
      space: 'screen',
      draw: (_data, v) => buildSceneViewCommands(scene, v, defaultDrawOne),
    },
  ], [paperLayer, scene]);
}
