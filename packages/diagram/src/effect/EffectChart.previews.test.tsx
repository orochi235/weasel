import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../DiagramView', () => ({ DiagramView: () => null }));
const released = vi.hoisted(() => [] as object[]);
vi.mock('@weasel-js/core/renderer', async (original) => ({
  ...(await original<object>()),
  releaseImageSource: (key: object) => { released.push(key); },
}));

import { EffectChart } from './EffectChart';
import type { EffectPipeline, EffectRun } from './types';

const pipeline: EffectPipeline = {
  stages: [{ id: 'a', title: 'A', outputs: [{ id: 'out', type: 'image' }, { id: 'mask', type: 'image' }] }],
  wires: [],
};
const OPTIONS = { showPreviews: true };
const bitmap = (): ImageBitmap => ({ width: 4, height: 4, close() {} }) as unknown as ImageBitmap;
const runOf = (previews: Record<string, ImageBitmap>): EffectRun => ({ stages: { a: { previews } } });

afterEach(() => {
  cleanup();
  released.length = 0;
});

// A proxy: that the chart asked the renderer to free a texture. Whether the
// texture is really freed, and not re-uploaded for a kept bitmap, is a browser check.
describe('EffectChart previews', () => {
  it('frees the texture of a preview a new run replaced, and keeps one it handed back', () => {
    const kept = bitmap();
    const first = bitmap();
    const chart = (run: EffectRun) => <EffectChart pipeline={pipeline} options={OPTIONS} run={run} width={100} height={100} />;
    const { rerender } = render(chart(runOf({ out: first, mask: kept })));
    expect(released).toEqual([]);
    rerender(chart(runOf({ out: bitmap(), mask: kept })));
    expect(released).toEqual([first]);
  });

  it('frees every preview it shows when it unmounts', () => {
    const out = bitmap();
    const { unmount } = render(<EffectChart pipeline={pipeline} options={OPTIONS} run={runOf({ out })} width={100} height={100} />);
    unmount();
    expect(released).toEqual([out]);
  });
});
