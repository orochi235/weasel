/** Plain-text paste on a canvas given `textPreset`: a text node, and only for text no other handler claims. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { createRef } from 'react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, createScene, type FeaturePreset, type Scene, type SceneCanvasApi } from '@weasel-js/core';
import { _resetContentHandlersForTests } from '@weasel-js/core/test-seams';
import {
  __setImageMeasureForTests, __setFileToDataUriForTests, _resetImageHandlerSeamsForTests,
} from '@weasel-js/editing/test-seams';
import { __setSvgMeasureForTests, _resetSvgHandlerSeamsForTests } from '@weasel-js/editing/test-seams';
import { textPreset } from '../presets';
import { ingestPreset, buildWeaselClipboardText } from '@weasel-js/editing';

type D = { text?: string; image?: { src: string } };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

const CLIENT_RECT = { left: 0, top: 0, right: 200, bottom: 150, width: 200, height: 150, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    getBoundingClientRect: () => DOMRect;
  };
  proto.getContext = vi.fn(() => null);
  proto.getBoundingClientRect = () => CLIENT_RECT;
});

beforeEach(() => {
  _resetContentHandlersForTests();
  _resetImageHandlerSeamsForTests();
  _resetSvgHandlerSeamsForTests();
  __setImageMeasureForTests(async () => ({ width: 100, height: 80 }));
  __setFileToDataUriForTests(async () => 'data:image/png;base64,TEST');
  __setSvgMeasureForTests(async () => ({ width: 100, height: 80 }));
});

const NODE_TEXT = buildWeaselClipboardText([
  { kind: 'mark', id: 'src-1', layer: 'main', parent: null, pose: { x: 10, y: 10, width: 20, height: 20 }, data: {} },
]);
const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';

const makeScene = (): Scene<D, L, P> => createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
const textNodesOf = (scene: Scene<D, L, P>) => scene.roots.map((id) => scene.get(id)!)
  .filter((n) => typeof (n.data as D).text === 'string');
const pngFile = (): File => new File(['x'], 'pic.png', { type: 'image/png' });
/** Long enough for the fire-and-forget ingest pipeline to have inserted. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

function mount(features: readonly FeaturePreset[]) {
  const scene = makeScene();
  render(<SceneCanvas features={features} scene={scene} layers={{}} width={64} height={64} />);
  return { scene };
}

function paste(data: { text?: string; files?: File[] }): void {
  const ev = new Event('paste', { cancelable: true });
  Object.assign(ev, {
    clipboardData: { files: data.files ?? [], getData: (t: string) => (t === 'text/plain' ? data.text ?? '' : '') },
  });
  act(() => { window.dispatchEvent(ev); });
}

describe('plain-text paste with textPreset', () => {
  it('turns pasted plain text into a text node, and leaves node payloads and SVG alone', async () => {
    const { scene } = mount([ingestPreset, textPreset]);
    paste({ text: 'hello\nworld' });
    await vi.waitFor(() => expect(textNodesOf(scene)).toHaveLength(1));
    expect(textNodesOf(scene)[0]!.data.text).toBe('hello\nworld');

    paste({ text: NODE_TEXT });
    paste({ text: SVG_TEXT });
    await vi.waitFor(() => expect(scene.roots).toHaveLength(3));
    await settle();
    expect(textNodesOf(scene)).toHaveLength(1);
    expect(scene.roots).toHaveLength(3);
  });

  it('inserts a pasted file once, without a text node for the name riding beside it', async () => {
    const { scene } = mount([ingestPreset, textPreset]);
    paste({ files: [pngFile()], text: 'a.png' });
    await vi.waitFor(() => expect(scene.roots).toHaveLength(1));
    await settle();
    expect(scene.roots).toHaveLength(1);
    expect(scene.get(scene.roots[0]!)!.data.text).toBeUndefined();
  });

  it('is a canvas’s own: one without textPreset takes no plain text, while another with it does', async () => {
    const quiet = makeScene();
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas features={[ingestPreset]} scene={quiet} layers={{}} width={64} height={64} ref={ref} />);
    const other = makeScene();
    const otherRef = createRef<SceneCanvasApi>();
    render(<SceneCanvas features={[ingestPreset, textPreset]} scene={other} layers={{}} width={64} height={64} ref={otherRef} />);

    act(() => { ref.current!.ingest([{ kind: 'string', mime: 'text/plain', text: 'words' }]); });
    act(() => { otherRef.current!.ingest([{ kind: 'string', mime: 'text/plain', text: 'words' }]); });
    await vi.waitFor(() => expect(textNodesOf(other)).toHaveLength(1));
    await settle();
    expect(quiet.roots).toHaveLength(0);
  });
});
