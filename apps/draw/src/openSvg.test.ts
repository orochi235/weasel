import { afterEach, describe, expect, it, vi } from 'vitest';
import { asNodeId, createScene } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { openSvgText } from './openSvg';
import { pickSvgFileNamed, SWILL_NAMESPACES } from './svgInterop';

function sceneWithOneShape() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  scene.add({
    kind: 'leaf', layer: 'default', id: asNodeId('old'),
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
    expect(scene.get(scene.roots[0])!.kind).toBe('container');
    expect(scene.childrenOf(scene.roots[0])).toHaveLength(1);
    expect(scene.historyEntries().at(-1)!.label).toBe('Open');

    scene.undo();
    expect(scene.roots).toEqual([asNodeId('old')]);
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
