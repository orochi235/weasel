import { act } from '@testing-library/react';
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { edgeIdOf } from '@weasel-js/diagram';
import { EffectEditor, editorScene, type EffectDoc, type EffectEditorApi } from '@weasel-js/diagram/effect';
import { registerCanvasFont } from '@weasel-js/font';

registerCanvasFont('sans-serif');

const DOC: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'blur', title: 'Blur', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
      { id: 'mix', title: 'Mix', inputs: [{ id: 'base', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
    ],
    wires: [{ id: 'w1', from: { stage: 'blur', port: 'out' }, to: { stage: 'mix', port: 'base' } }],
  },
  places: { blur: { x: 20, y: 20 }, mix: { x: 480, y: 20 } },
  pages: [{ id: 'p1', width: 400, height: 300 }, { id: 'p2', width: 400, height: 300 }],
};

const tagIds = () => editorScene(DOC).data.edges.flatMap((e) => [`${edgeIdOf(e)}/offpage-from`, `${edgeIdOf(e)}/offpage-to`]);
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe('<EffectEditor> pages', () => {
  it('draws an off-page tag at each end of a wire between pages, under nodeGraph only', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const api = createRef<EffectEditorApi>();
    const render = (look: 'nodeGraph' | 'rack') => act(async () => {
      root ??= createRoot(host);
      root.render(<EffectEditor ref={api} doc={DOC} look={look} onChange={() => {}} width={900} height={400} />);
    });
    await render('nodeGraph');
    await frame();
    await frame();
    await expect.poll(() => tagIds().map((id) => api.current?.rectOf(id) != null)).toEqual([true, true]);
    await render('rack');
    await frame();
    await frame();
    expect(tagIds().map((id) => api.current?.rectOf(id) ?? null)).toEqual([null, null]);
  });
});
