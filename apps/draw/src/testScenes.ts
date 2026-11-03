/** Draw scenes for tests. */
import { createPageRun, createScene, type Page } from '@weasel-js/core';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';

/** An empty draw scene on one layer, `default`, paged with `pages` when given. */
export function drawScene(pages?: readonly Page[]): DrawScene {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  if (pages) createPageRun(scene, pages);
  return scene;
}
