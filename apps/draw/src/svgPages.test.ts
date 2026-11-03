import { describe, expect, it } from 'vitest';
import { boundsOfPath, createPageRun, createScene, type NodeId, pagesOf, placedPagesOf, solid } from '@weasel-js/core';
import { parseSvg } from '@weasel-js/svg';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { openSvgText } from './openSvg';
import { pageToSvgString, sceneToSvgString } from './svgExport';
import { SWILL_NAMESPACES } from './svgInterop';

const PAGES = [{ id: 'page-1', width: 816, height: 1056 }, { id: 'cover', name: 'Back & "cover"', width: 794, height: 1123 }];

const square = (scene: DrawScene, page: string, color: string) => scene.add({
  kind: 'mark', layer: 'default', parent: page as NodeId, pose: { x: 10, y: 10, width: 20, height: 20 },
  data: { path: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 }, fill: { paint: solid(color) } },
});

/** A drawing of two pages, a red square on the first and a blue one on the second, each 10 in from its corner. */
function twoPages() {
  const scene = emptyScene();
  createPageRun(scene, PAGES);
  square(scene, 'page-1', '#ff0000');
  square(scene, 'cover', '#0000ff');
  return scene;
}

function emptyScene() {
  return createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
}

const save = (scene: DrawScene, backgroundColor = '#ffffff') =>
  sceneToSvgString(scene, { filename: 'a.svg', pages: placedPagesOf(scene), backgroundColor });

/** Each page's children as `[page, x]`, in page order. */
const onPages = (scene: DrawScene) => placedPagesOf(scene).flatMap((p) =>
  scene.childrenOf(p.id as NodeId).map((id) => [p.id, (scene.get(id)!.pose as WeaselDrawPose).x]));

describe('saving a drawing of several pages', () => {
  it('spans every page, and opens with its pages, names, and background', async () => {
    const svg = await save(twoPages(), '#ffffcc');
    expect(parseSvg(svg).viewBox).toEqual({ x: 0, y: 0, width: 816 + 40 + 794, height: 1123 });

    const opened = emptyScene();
    expect(openSvgText(opened, svg, 'a.svg').backgroundColor).toBe('#ffffcc');
    expect(pagesOf(opened)?.pages).toEqual(PAGES);
  });

  it('writes each shape where it is in the world, and writes no page or run as a group', async () => {
    const parsed = parseSvg(await save(twoPages()));
    expect(parsed.nodes.map((n) => n.kind)).toEqual(['path', 'path']);
    expect(parsed.nodes.map((n) => n.kind === 'path' && boundsOfPath(n.path).x)).toEqual([10, 866]);
  });

  it('opens each shape as a child of its page, in page-local coordinates, and saves it to the same place', async () => {
    const svg = await save(twoPages());
    const opened = emptyScene();
    openSvgText(opened, svg, 'a.svg');
    expect(onPages(opened)).toEqual([['page-1', 10], ['cover', 10]]);
    const unminted = (text: string) => text.replace(/ wd:leaf-id="[^"]*"/g, '');
    expect(unminted(await save(opened))).toBe(unminted(svg));
  });

  it('writes the first page\'s paper size as wd:paperSize, which a reader from before pages takes', async () => {
    const svg = await save(twoPages());
    expect(parseSvg(svg, { namespaces: SWILL_NAMESPACES }).documentMeta?.wd?.attrs?.paperSize).toBe('letter');
  });
});

describe('opening a file from before pages', () => {
  it('opens one page of the paper size it declares, with the file\'s shapes on it', () => {
    const scene = twoPages();
    openSvgText(scene, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:wd="${SWILL_NAMESPACES.wd}" viewBox="0 0 816 1344" wd:paperSize="legal"><rect x="3" width="5" height="5"/></svg>`, 'old.svg');
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 816, height: 1344 }]);
    expect(onPages(scene)).toEqual([['page-1', 3]]);
  });
});

describe('exporting one page', () => {
  it('frames the page, and writes what is on it', async () => {
    const scene = twoPages();
    const page = placedPagesOf(scene)[1]!;
    const parsed = parseSvg(await pageToSvgString(scene, page, { backgroundColor: '#ffffff' }));
    expect(parsed.viewBox).toEqual({ x: 856, y: 0, width: 794, height: 1123 });
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]).toMatchObject({ fill: { color: '#0000ff' } });
  });
});
