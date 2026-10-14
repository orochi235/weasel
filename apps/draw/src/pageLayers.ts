import { buildSceneViewCommands, defaultDrawOne, layoutPages, pagesLayer, type RenderLayer } from '@weasel-js/core';
import { useMemo } from 'react';
import type { DrawScene } from './drawDocument';

export interface PageSize { width: number; height: number }

/** The document page: a world-space rect filled with the document's background color, so the
 *  workspace stripes show everywhere outside it. */
export function usePaperLayer(page: PageSize, backgroundColor: string): RenderLayer<unknown> {
  return useMemo<RenderLayer<unknown>>(
    () => pagesLayer(
      layoutPages([{ id: 'page', width: page.width, height: page.height }]),
      { fill: backgroundColor, id: 'paper', label: 'Paper' },
    ),
    [page.width, page.height, backgroundColor],
  );
}

/** What the loupe magnifies: the page and the scene on top of it. The scene half projects inside
 *  `buildSceneViewCommands`, which is what `space: 'screen'` says about it. */
export function useLoupeSource(scene: DrawScene, page: PageSize, backgroundColor: string): RenderLayer<unknown>[] {
  const paperLayer = usePaperLayer(page, backgroundColor);
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
