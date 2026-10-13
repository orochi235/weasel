import { buildSceneViewCommands, defaultDrawOne, type RenderLayer } from '@weasel-js/core';
import { useMemo } from 'react';
import type { DrawScene } from './drawDocument';

export interface PageSize { width: number; height: number }

/** The document page: a world-space rect filled with the document's background color, so the
 *  workspace stripes show everywhere outside it. */
export function usePaperLayer(page: PageSize, backgroundColor: string): RenderLayer<unknown> {
  return useMemo<RenderLayer<unknown>>(() => ({
    id: 'paper',
    label: 'Paper',
    draw: () => [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: page.width, height: page.height },
      fill: { paint: { kind: 'solid', color: backgroundColor } },
    }],
  }), [page.width, page.height, backgroundColor]);
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
