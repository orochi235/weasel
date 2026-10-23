import { afterEach, describe, expect, it, vi } from 'vitest';
import { asNodeId, createScene } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { importSvgText, openSvgFile, openSvgText } from './openSvg';
import { pickSvgFileNamed, SWILL_NAMESPACES } from './svgInterop';

function sceneWithOneShape() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
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

  it('takes the paper size the file declares, and none when it declares none', () => {
    expect(openSvgText(sceneWithOneShape(), svg(TWO, 'wd:paperSize="a4"'), 'a.svg').paperSize).toBe('a4');
    expect(openSvgText(sceneWithOneShape(), svg(TWO), 'a.svg').paperSize).toBeUndefined();
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

  it('opens as a container holding its clip', () => {
    const scene = sceneWithOneShape();
    openSvgText(scene, svg(CLIPPED), 'a.svg');
    expect(scene.get(scene.roots[0])).toMatchObject({ kind: 'group', data: clip });
  });

  it('imports as a container holding its clip', () => {
    const scene = sceneWithOneShape();
    importSvgText(scene, svg(CLIPPED));
    expect(scene.get(scene.roots[1])).toMatchObject({ kind: 'group', data: clip });
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
    setPaperSize: vi.fn(),
    setBackgroundColor: vi.fn(),
  });

  it('replaces the document with the picked file and names it after the file', async () => {
    pick(new File([svg(TWO, 'wd:paperSize="a4"')], 'art.svg', { type: 'image/svg+xml' }));
    const t = target();
    await openSvgFile(t);
    expect(t.scene.get(asNodeId('old'))).toBeUndefined();
    expect(t.scene.roots).toHaveLength(2);
    expect(t.setFilename).toHaveBeenCalledWith('art.svg');
    expect(t.setPaperSize).toHaveBeenCalledWith('a4');
    expect(t.setBackgroundColor).toHaveBeenCalledWith('#ffffff');
  });

  it('keeps the paper size when the file declares none', async () => {
    pick(new File([svg(TWO)], 'art.svg'));
    const t = target();
    await openSvgFile(t);
    expect(t.setPaperSize).not.toHaveBeenCalled();
  });

  it('leaves the document alone when the picker is canceled', async () => {
    pick(null);
    const t = target();
    await openSvgFile(t);
    expect(t.scene.roots).toEqual([asNodeId('old')]);
    expect(t.setFilename).not.toHaveBeenCalled();
  });
});
