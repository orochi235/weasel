import { describe, expect, it } from 'vitest';
import { WeaselRenderer } from '../../WeaselRenderer';
import { fakeGpuDevice } from '../../testing/fakeGpuDevice';

function renderer(fake = fakeGpuDevice()) {
  const r = new WeaselRenderer({
    gpu: { device: fake.device, canvas: fake.canvas as unknown as HTMLCanvasElement, context: fake.context },
    width: 64, height: 64, dpr: 1,
  });
  return { fake, r };
}

describe('a WebGPU renderer', () => {
  it('destroys every buffer and texture it made when disposed', () => {
    const { fake, r } = renderer();
    r.render([{ kind: 'rect', x: 0, y: 0, width: 10, height: 10, fill: { kind: 'solid', color: [1, 0, 0, 1] } } as never]);
    r.dispose();
    const kept = [...fake.buffers, ...fake.textures].filter((o) => !o.destroyed && o.label !== 'context');
    expect(kept.map((o) => o.label)).toEqual([]);
  });
});
