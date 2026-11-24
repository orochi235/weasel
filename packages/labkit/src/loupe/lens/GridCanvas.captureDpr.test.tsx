import { act, render } from '@testing-library/react';
import { beforeAll, expect, test, vi } from 'vitest';
import { GridCanvas } from './GridCanvas';
import type { LensSource, LensSourceRequest } from './lensSource';
import { drawPixelGrid } from './pixelGrid';

vi.mock('./pixelGrid', async (load) => ({
  ...(await load<typeof import('./pixelGrid')>()),
  drawPixelGrid: vi.fn(),
  readBitmap: (bitmap: { width: number; height: number }) => ({
    width: bitmap.width,
    height: bitmap.height,
    data: new Uint8ClampedArray(bitmap.width * bitmap.height * 4),
  }),
}));

beforeAll(() => {
  const ctx = new Proxy({}, { get: () => () => {} });
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const request: LensSourceRequest<null> = {
  lensId: 'a',
  reticle: { x: 0, y: 0 },
  factor: 16,
  size: { width: 50, height: 40 },
  conditions: null,
  dpr: 2,
};

test('draws the grid at the capture’s own DPR when it was taken at fewer pixels than asked', async () => {
  const box = { width: 50 / 16, height: 40 / 16 };
  const source: LensSource<null> = {
    kind: 'pixels',
    produces: 'pixels',
    label: () => 'Pixels',
    status: () => true,
    subscribe: () => () => {},
    attach: () => ({ update() {}, detach() {} }),
    capture: async () => ({
      bitmap: { width: 3, height: 3, close() {} } as unknown as ImageBitmap,
      dpr: 1,
      box,
      at: { x: 1.5, y: 1.25 },
    }),
  };
  render(<GridCanvas source={source} request={request} />);
  await act(async () => void (await new Promise((r) => setTimeout(r, 0))));
  const views = vi.mocked(drawPixelGrid).mock.calls.map(([, view]) => view);
  expect(views.at(-1)).toMatchObject({ dpr: 1, columns: 3 });
});
