import { afterEach, describe, expect, it, vi } from 'vitest';
import { asNodeId, createScene, PAGES_DOC_KEY, pagesOf, solid, type NodeId, layoutPages } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { importSvgText, openSvgFile, openSvgText } from './openSvg';
import { pickSvgFileNamed, SWILL_NAMESPACES } from './svgInterop';
import { sceneToSvgString } from './svgExport';

function sceneWithOneShape() {
  const legal = { width: 816, height: 1344 };
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    doc: { [PAGES_DOC_KEY]: { pages: [{ id: 'page-1', ...legal }, { id: 'page-2', ...legal }] } },
  });
  scene.add({
    kind: 'mark', layer: 'default', id: asNodeId('old'),
    pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } },
  });
  return scene;
}

const svg = (body: string, attrs = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:wd="${SWILL_NAMESPACES.wd}" viewBox="0 0 100 100" ${attrs}>${body}</svg>`;
const TWO = '<g><rect x="1" y="1" width="5" height="5" fill="#ff0000"/></g><circle cx="50" cy="50" r="4" fill="#00ff00"/>';

describe('openSvgText', () => {
  it('replaces the document with the file, as one undo entry labeled Open', () => {
    const scene = sceneWithOneShape();
    openSvgText(scene, svg(TWO), 'art.svg');
    expect(scene.get(asNodeId('old'))).toBeUndefined();
    expect(scene.roots).toHaveLength(2);
    expect(scene.get(scene.roots[0])!.kind).toBe('group');
    expect(scene.childrenOf(scene.roots[0])).toHaveLength(1);
    expect(scene.historyEntries().at(-1)!.label).toBe('Open');

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('old')]);
  });

  it('keeps hidden content, hidden, so an exported hidden node opens as it was', () => {
    const scene = sceneWithOneShape();
    openSvgText(scene, svg('<g display="none"><rect x="1" y="1" width="5" height="5"/></g><rect x="9" y="9" width="5" height="5" display="none"/>'), 'a.svg');
    expect(scene.roots.map((id) => scene.get(id)!.hidden)).toEqual([true, true]);
    expect(scene.isHidden(scene.childrenOf(scene.roots[0])[0])).toBe(true);
  });

  it('names the document after the picked file', () => {
    expect(openSvgText(sceneWithOneShape(), svg(TWO), 'art.svg').filename).toBe('art.svg');
  });

  it('opens as one page of the paper size the file declares, in the Open entry', () => {
    const scene = sceneWithOneShape();
    openSvgText(scene, svg(TWO, 'wd:paperSize="a4"'), 'a.svg');
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 794, height: 1123 }]);
    scene.undo();
    expect(pagesOf(scene)?.pages).toHaveLength(2);
  });

  it('opens a file that declares no paper size as one page of the first page\'s size', () => {
    const scene = sceneWithOneShape();
    openSvgText(scene, svg(TWO), 'a.svg');
    expect(pagesOf(scene)?.pages).toEqual([{ id: 'page-1', width: 816, height: 1344 }]);
  });

  it('resets the background to white when the file names none', () => {
    expect(openSvgText(sceneWithOneShape(), svg(TWO), 'a.svg').backgroundColor).toBe('#ffffff');
  });

  it('passes each import warning to onWarn', () => {
    const warnings: unknown[] = [];
    openSvgText(sceneWithOneShape(), svg('<foreignObject width="5" height="5"/>'), 'a.svg', (w) => warnings.push(w));
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('a clipped group', () => {
  const CLIPPED = '<clipPath id="c"><rect x="10" y="10" width="20" height="40"/></clipPath>'
    + '<g clip-path="url(#c)"><rect width="100" height="100" fill="#ff0000"/></g>';
  const clip = { path: { kind: 'rect', x: 10, y: 10, width: 20, height: 40 }, fill: null };

  it('opens as a group declaring and holding its clip', () => {
    const scene = sceneWithOneShape();
    openSvgText(scene, svg(CLIPPED), 'a.svg');
    expect(scene.get(scene.roots[0])).toMatchObject({ kind: 'group', clip: 'outline', data: clip });
  });

  it('imports as a group declaring and holding its clip', () => {
    const scene = sceneWithOneShape();
    importSvgText(scene, svg(CLIPPED));
    expect(scene.get(scene.roots[1])).toMatchObject({ kind: 'group', clip: 'outline', data: clip });
  });
});

describe('Save then Open: a mark with children', () => {
  const PAGE = { filename: 'page', pages: layoutPages([{ id: 'page-1', width: 100, height: 100 }]), backgroundColor: '#ffffff' } as const;
  const rect = (w: number, h: number) => ({ kind: 'rect' as const, x: 0, y: 0, width: w, height: h });

  /** A group holding a red mark that holds two blue ones; `clip` is the red mark's. */
  function drawn(clip?: 'outline') {
    const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
    const g = scene.add({ kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 40, height: 40 }, data: {} });
    const m = scene.add({
      kind: 'mark', layer: 'default', parent: g, pose: { x: 0, y: 0, width: 40, height: 40 },
      data: { path: rect(40, 40), fill: { paint: solid('#ff0000') } }, ...(clip ? { clip } : {}),
    });
    for (const x of [5, 20]) {
      scene.add({
        kind: 'mark', layer: 'default', parent: m, pose: { x, y: 5, width: 10, height: 10 },
        data: { path: rect(10, 10), fill: { paint: solid('#0000ff') } },
      });
    }
    return scene;
  }
  type Drawn = ReturnType<typeof drawn>;
  /** Each node, depth first, as its kind and the index of its parent in the same list. */
  const shape = (scene: Drawn) => {
    const order: NodeId[] = [];
    const walk = (id: NodeId) => { order.push(id); scene.childrenOf(id).forEach(walk); };
    scene.roots.forEach(walk);
    return order.map((id) => {
      const n = scene.get(id)!;
      return [n.kind, n.parent === null ? -1 : order.indexOf(n.parent)];
    });
  };

  it.each([undefined, 'outline'] as const)('reopens with the same kinds and parents, clip %s', async (clip) => {
    const saved = drawn(clip);
    const reopened = sceneWithOneShape();
    openSvgText(reopened, await sceneToSvgString(saved, PAGE), 'page.svg');
    expect(shape(reopened)).toEqual(shape(saved));
    expect(shape(reopened)).toEqual([['group', -1], ['mark', 0], ['mark', 1], ['mark', 1]]);
    const mark = reopened.get(reopened.childrenOf(reopened.roots[0])[0])!;
    expect(mark.data.fill).toMatchObject({ paint: { color: '#ff0000' } });
    expect(mark.clip).toBe(clip);
    expect(reopened.get(reopened.childrenOf(mark.id)[0])!.data.fill).toMatchObject({ paint: { color: '#0000ff' } });
  });
});

describe('importSvgText', () => {
  it('adds the file to the document, as one undo entry labeled Import SVG', () => {
    const scene = sceneWithOneShape();
    importSvgText(scene, svg(TWO));
    expect(scene.roots).toHaveLength(3);
    expect(scene.roots[0]).toBe(asNodeId('old'));
    expect(scene.historyEntries().at(-1)!.label).toBe('Import SVG');

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('old')]);
  });
});

describe('pickSvgFileNamed', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves with the picked file\'s name beside its text', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [new File(['<svg/>'], 'art.svg', { type: 'image/svg+xml' })] });
      this.dispatchEvent(new Event('change'));
    });
    expect(await pickSvgFileNamed()).toEqual({ name: 'art.svg', text: '<svg/>' });
  });
});

describe('openSvgFile', () => {
  afterEach(() => vi.restoreAllMocks());

  const pick = (file: File | null): void => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: file ? [file] : [] });
      this.dispatchEvent(new Event(file ? 'change' : 'cancel'));
    });
  };
  const target = (scene = sceneWithOneShape()) => ({
    scene,
    setFilename: vi.fn(),
    showFirstPage: vi.fn(), leaveMode: vi.fn(),
    setBackgroundColor: vi.fn(),
  });

  it('replaces the document with the picked file and names it after the file', async () => {
    pick(new File([svg(TWO, 'wd:paperSize="a4"')], 'art.svg', { type: 'image/svg+xml' }));
    const t = target();
    t.leaveMode.mockImplementation(() => { expect(t.scene.get(asNodeId('old'))).toBeDefined(); });
    await openSvgFile(t);
    expect(t.leaveMode).toHaveBeenCalledOnce();
    expect(t.scene.get(asNodeId('old'))).toBeUndefined();
    expect(t.scene.roots).toHaveLength(2);
    expect(t.setFilename).toHaveBeenCalledWith('art.svg');
    expect(pagesOf(t.scene)?.pages[0]).toMatchObject({ width: 794, height: 1123 });
    expect(t.setBackgroundColor).toHaveBeenCalledWith('#ffffff');
    expect(t.showFirstPage).toHaveBeenCalledOnce();
  });

  it('leaves the document alone when the picker is canceled', async () => {
    pick(null);
    const t = target();
    await openSvgFile(t);
    expect(t.scene.roots).toEqual([asNodeId('old')]);
    expect(t.setFilename).not.toHaveBeenCalled();
    expect(t.showFirstPage).not.toHaveBeenCalled();
    expect(t.leaveMode).not.toHaveBeenCalled();
  });
});
