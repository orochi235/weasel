import { buildSceneViewCommands, defaultDrawOne, type PlacedPage, type RenderLayer } from '@weasel-js/core';
import { usePaperLayer } from '@weasel-js/editor';
import { useMemo } from 'react';
import type { DrawScene } from './drawDocument';

/** What the loupe magnifies: the pages and the scene on top of them. The scene half projects inside
 *  `buildSceneViewCommands`, which is what `space: 'screen'` says about it. */
export function useLoupeSource(scene: DrawScene, pages: readonly PlacedPage[], backgroundColor: string): RenderLayer<unknown>[] {
  const paperLayer = usePaperLayer(pages, backgroundColor);
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
