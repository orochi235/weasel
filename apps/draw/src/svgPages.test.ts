import { describe, expect, it } from 'vitest';
import { createScene, PAGES_DOC_KEY, pagesOf, placedPagesOf, solid } from '@weasel-js/core';
import { parseSvg } from '@weasel-js/svg';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { openSvgText } from './openSvg';
import { pageToSvgString, sceneToSvgString } from './svgExport';
import { SWILL_NAMESPACES } from './svgInterop';

const PAGES = [{ id: 'page-1', width: 816, height: 1056 }, { id: 'cover', name: 'Back & "cover"', width: 794, height: 1123 }];

/** A drawing of two pages, a red square on the first and a blue one on the second, 856 to its right. */
function twoPages() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    doc: { [PAGES_DOC_KEY]: { pages: PAGES } },
  });
  const square = (x: number, color: string) => scene.add({
    kind: 'mark', layer: 'default', pose: { x, y: 10, width: 20, height: 20 },
    data: { path: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 }, fill: { paint: solid(color) } },
  });
  square(10, '#ff0000');
  square(856 + 10, '#0000ff');
  return scene;
}

function emptyScene() {
  return createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
}

describe('saving a drawing of several pages', () => {
  it('spans every page, and opens with its pages, names, and shapes where they were', async () => {
    const scene = twoPages();
    const svg = await sceneToSvgString(scene, { filename: 'a.svg', pages: placedPagesOf(scene), backgroundColor: '#ffffcc' });
    expect(parseSvg(svg).viewBox).toEqual({ x: 0, y: 0, width: 816 + 40 + 794, height: 1123 });

    const opened = emptyScene();
    expect(openSvgText(opened, svg, 'a.svg').backgroundColor).toBe('#ffffcc');
    expect(pagesOf(opened)?.pages).toEqual(PAGES);
    expect(opened.roots.map((id) => (opened.get(id)!.pose as WeaselDrawPose).x)).toEqual([10, 866]);
  });

  it('writes the first page\'s paper size as wd:paperSize, which a reader from before pages takes', async () => {
    const scene = twoPages();
    const svg = await sceneToSvgString(scene, { filename: 'a.svg', pages: placedPagesOf(scene), backgroundColor: '#ffffff' });
    expect(parseSvg(svg, { namespaces: SWILL_NAMESPACES }).documentMeta?.wd?.attrs?.paperSize).toBe('letter');
  });
});

describe('opening a file from before pages', () => {
  it('opens one page of the paper size it declares', () => {
    const scene = twoPages();
    openSvgText(scene, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:wd="${SWILL_NAMESPACES.wd}" viewBox="0 0 816 1344" wd:paperSize="legal"><rect width="5" height="5"/></svg>`, 'old.svg');
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 816, height: 1344 }]);
  });
});

describe('exporting one page', () => {
  it('frames the page, and leaves out what lies wholly off it', async () => {
    const scene = twoPages();
    const page = placedPagesOf(scene)[1]!;
    const parsed = parseSvg(await pageToSvgString(scene, page, { backgroundColor: '#ffffff' }));
    expect(parsed.viewBox).toEqual({ x: 856, y: 0, width: 794, height: 1123 });
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]).toMatchObject({ fill: { color: '#0000ff' } });
  });
});
