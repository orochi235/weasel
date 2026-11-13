import { describe, expect, it } from 'vitest';
import {
  boundsOfPath, createPageRun, createScene, type NodeId, pageNodeOf, pageOfNode, pageRunOf, pagesOf, placedPagesOf, solid,
} from '@weasel-js/core';
import { exportRegionSvg, parseSvg, type SvgGroupNode } from '@weasel-js/svg';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { backgroundOf } from './docBackground';
import { openSvgText } from './openSvg';
import { sceneToSvgString } from './svgExport';
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

/** The tree under the page run, as each node's page, kind, and pose, ids aside. */
const tree = (scene: DrawScene): unknown => {
  const walk = (id: NodeId): unknown => {
    const n = scene.get(id)!;
    return { page: n.page === undefined ? undefined : pageOfNode(scene, id), kind: n.kind, pose: n.pose, children: scene.childrenOf(id).map(walk) };
  };
  return scene.childrenOf(pageRunOf(scene)!).map(walk);
};

/** Each page's children as `[page, x]`, in page order. */
const onPages = (scene: DrawScene) => placedPagesOf(scene).flatMap((p) =>
  scene.childrenOf(p.id as NodeId).map((id) => [p.id, (scene.get(id)!.pose as WeaselDrawPose).x]));

describe('saving a drawing of several pages', () => {
  it('spans every page, and opens with its pages, names, and background', async () => {
    const svg = await save(twoPages(), '#ffffcc');
    expect(parseSvg(svg).viewBox).toEqual({ x: 0, y: 0, width: 816 + 40 + 794, height: 1123 });

    const opened = emptyScene();
    openSvgText(opened, svg, 'a.svg');
    expect(backgroundOf(opened)).toBe('#ffffcc');
    expect(pagesOf(opened)?.pages).toEqual(PAGES);
  });

  it('writes each shape where it is in the world, in a group per page clipped to the page', async () => {
    const parsed = parseSvg(await save(twoPages()), { namespaces: SWILL_NAMESPACES });
    const groups = parsed.nodes as SvgGroupNode[];
    expect(groups.map((g) => [g.kind, g.meta?.wd?.attrs])).toEqual([
      ['group', { role: 'page', 'page-id': 'page-1' }],
      ['group', { role: 'page', 'page-id': 'cover' }],
    ]);
    expect(groups.map((g) => g.clip)).toEqual([
      { kind: 'rect', x: 0, y: 0, width: 816, height: 1056 },
      { kind: 'rect', x: 856, y: 0, width: 794, height: 1123 },
    ]);
    expect(groups.map((g) => { const [n] = g.children; return n?.kind === 'path' && boundsOfPath(n.path).x; })).toEqual([10, 866]);
  });

  it('opens a shape hanging off its page onto that page, whichever page holds most of it, and saves it the same', async () => {
    const scene = twoPages();
    // 790..1000 on page-1: most of it lies over the gap and the cover page.
    scene.add({
      kind: 'mark', layer: 'default', parent: 'page-1' as NodeId, pose: { x: 790, y: 100, width: 210, height: 20 },
      data: { path: { kind: 'rect', x: 0, y: 0, width: 210, height: 20 }, fill: { paint: solid('#00ff00') } },
    });
    const svg = await save(scene);
    const opened = emptyScene();
    openSvgText(opened, svg, 'a.svg');
    expect(tree(opened)).toEqual(tree(scene));
    const unminted = (text: string) => text.replace(/ wd:leaf-id="[^"]*"/g, '');
    expect(unminted(await save(opened))).toBe(unminted(svg));
  });

  it('opens a page\'s group as the page, with no clip group of its own', async () => {
    const opened = emptyScene();
    openSvgText(opened, await save(twoPages()), 'a.svg');
    expect([...opened.nodes.values()].filter((n) => n.kind === 'group' && n.page === undefined && n.pageRun === undefined)).toEqual([]);
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

// File › Export writes a page through the registered `svg` format, which is `exportRegionSvg`.
describe('exporting one page', () => {
  it('frames the page, and writes what is on it', async () => {
    const scene = twoPages();
    const page = placedPagesOf(scene)[1]!;
    const parsed = parseSvg(await exportRegionSvg(scene, page));
    expect(parsed.viewBox).toEqual({ x: 856, y: 0, width: 794, height: 1123 });
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]).toMatchObject({ fill: { color: '#0000ff' } });
  });

  it('writes a node following others with each page it crosses, and with no other', async () => {
    const scene = twoPages();
    const [p1, p2] = placedPagesOf(scene);
    scene.add({
      kind: 'mark', layer: 'default', parent: pageRunOf(scene), dependsOn: scene.childrenOf('page-1' as NodeId),
      pose: { x: 900, y: 500, width: 20, height: 20 },
      data: { path: { kind: 'rect', x: 0, y: 0, width: 20, height: 20 }, fill: { paint: solid('#00ff00') } },
    });
    const colors = async (page: typeof p1) => parseSvg(await exportRegionSvg(scene, page!))
      .nodes.map((n) => (n as { fill?: { color?: string } }).fill?.color);
    expect(await colors(p2)).toEqual(['#0000ff', '#00ff00']);
    expect(await colors(p1)).toEqual(['#ff0000']);
  });

  it('writes what is on a page whose id a node already holds', async () => {
    const scene = emptyScene();
    scene.add({
      id: 'cover' as NodeId, kind: 'mark', layer: 'default', pose: { x: -500, y: -500, width: 5, height: 5 },
      data: { path: { kind: 'rect', x: 0, y: 0, width: 5, height: 5 }, fill: { paint: solid('#00ff00') } },
    });
    createPageRun(scene, PAGES);
    square(scene, pageNodeOf(scene, 'cover')!, '#0000ff');
    const cover = placedPagesOf(scene).find((p) => p.id === 'cover')!;
    const parsed = parseSvg(await exportRegionSvg(scene, cover));
    expect(parsed.nodes.map((n) => (n as { fill?: { color?: string } }).fill?.color)).toEqual(['#0000ff']);
  });
});
