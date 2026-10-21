import { act, forwardRef, useImperativeHandle, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerCanvasFont } from '@weasel-js/font';
import type { DiagramViewApi, DiagramViewProps } from '../DiagramView';
import { edgeIdOf } from '../fromData';
import { EffectEditor } from './EffectEditor';
import { editorScene } from './editorMapping';
import type { EffectDoc } from './types';

registerCanvasFont('sans-serif');

const live: { api: DiagramViewApi | null } = { api: null };

// EffectEditor keeps its DiagramViewApi private, so the test reads it through a spy wrapper.
vi.mock('../DiagramView', async (original) => {
  const real = await original<typeof import('../DiagramView')>();
  const Spy = forwardRef<DiagramViewApi, DiagramViewProps>(function Spy(props, ref) {
    const inner = useRef<DiagramViewApi | null>(null);
    useImperativeHandle(ref, () => inner.current!);
    return <real.DiagramView {...props} ref={(api) => { inner.current = api; live.api = api; }} />;
  });
  return { ...real, DiagramView: Spy };
});

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
  live.api = null;
  document.body.replaceChildren();
});

describe('<EffectEditor> pages', () => {
  it('draws an off-page tag at each end of a wire between pages, under nodeGraph only', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const render = (look: 'nodeGraph' | 'rack') => act(async () => {
      root ??= createRoot(host);
      root.render(<EffectEditor doc={DOC} look={look} onChange={() => {}} width={900} height={400} />);
    });
    await render('nodeGraph');
    await frame();
    await frame();
    await expect.poll(() => tagIds().map((id) => live.api?.rectOf(id) != null)).toEqual([true, true]);
    await render('rack');
    await frame();
    await frame();
    expect(tagIds().map((id) => live.api?.rectOf(id) ?? null)).toEqual([null, null]);
  });
});
