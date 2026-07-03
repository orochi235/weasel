import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  kitImageHandler,
  __setImageMeasureForTests,
  __setFileToDataUriForTests,
  _resetImageHandlerSeamsForTests,
} from './imageHandler';
import type { IngestCtx } from './contentHandlers';
import type { IngestItem } from './ingestItems';

const file = (name: string) => new File(['x'], name, { type: 'image/png' });
const item = (f: File): IngestItem => ({ kind: 'file', mime: 'image/png', file: f });

function ctx(overrides: Partial<IngestCtx> = {}): IngestCtx & { insert: { commit: ReturnType<typeof vi.fn> } } {
  return {
    point: null,
    viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    insert: { commit: vi.fn() },
    applyOps: vi.fn(),
    scene: {} as never,
    selection: {} as never,
    deps: {},
    ...overrides,
  } as never;
}

beforeEach(() => {
  _resetImageHandlerSeamsForTests();
  __setImageMeasureForTests(async () => ({ width: 400, height: 300 }));
  __setFileToDataUriForTests(async (f) => `data:image/png;base64,${f.name}`);
});

describe('kitImageHandler', () => {
  it('matches image/* files only', () => {
    const m = kitImageHandler.match as (i: IngestItem) => boolean;
    expect(m(item(file('a.png')))).toBe(true);
    expect(m({ kind: 'string', mime: 'image/svg+xml', text: '' })).toBe(false);
    expect(m({ kind: 'file', mime: 'text/csv', file: file('x') })).toBe(false);
  });

  it('inserts at natural size centered on point', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await kitImageHandler.handle([item(file('a.png'))], c);
    expect(c.insert.commit).toHaveBeenCalledWith(
      { x: -100, y: -50, width: 400, height: 300 },
      { kind: 'image', src: 'data:image/png;base64,a.png' },
    );
  });

  it('centers on the viewport when point is null', async () => {
    const c = ctx();
    await kitImageHandler.handle([item(file('a.png'))], c);
    const [bounds] = c.insert.commit.mock.calls[0];
    expect(bounds.x + bounds.width / 2).toBeCloseTo(400);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(300);
  });

  it('fit-clamps oversized images to 90% of the viewport, preserving aspect', async () => {
    __setImageMeasureForTests(async () => ({ width: 4000, height: 1000 }));
    const c = ctx();
    await kitImageHandler.handle([item(file('big.png'))], c);
    const [bounds] = c.insert.commit.mock.calls[0];
    expect(bounds.width).toBeCloseTo(720);   // 800 * 0.9
    expect(bounds.height).toBeCloseTo(180);  // aspect preserved
  });

  it('cascades multiple files by a fixed offset', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await kitImageHandler.handle([item(file('a.png')), item(file('b.png'))], c);
    const [b0] = c.insert.commit.mock.calls[0];
    const [b1] = c.insert.commit.mock.calls[1];
    expect(b1.x - b0.x).toBe(24);
    expect(b1.y - b0.y).toBe(24);
  });

  it('prefers ctx.resolveSrc over the data-URI embed', async () => {
    const c = ctx({ point: { x: 0, y: 0 }, resolveSrc: async () => 'https://cdn/x.png' });
    await kitImageHandler.handle([item(file('a.png'))], c);
    expect(c.insert.commit.mock.calls[0][1]).toEqual({ kind: 'image', src: 'https://cdn/x.png' });
  });

  it('a file that fails to measure is skipped with a warn; others proceed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let n = 0;
    __setImageMeasureForTests(async () => {
      if (n++ === 0) throw new Error('bad image');
      return { width: 10, height: 10 };
    });
    const c = ctx({ point: { x: 0, y: 0 } });
    await kitImageHandler.handle([item(file('bad.png')), item(file('ok.png'))], c);
    expect(c.insert.commit).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});
