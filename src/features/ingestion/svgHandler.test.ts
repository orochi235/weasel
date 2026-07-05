import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  kitSvgHandler,
  isSvgFileItem,
  __setSvgMeasureForTests,
  _resetSvgHandlerSeamsForTests,
} from './svgHandler';
import {
  kitImageHandler,
  __setFileToDataUriForTests,
  _resetImageHandlerSeamsForTests,
} from './imageHandler';
import type { IngestCtx } from './contentHandlers';
import type { IngestItem } from './ingestItems';

const svgFile = (name = 'pic.svg', type = 'image/svg+xml') =>
  new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], name, { type });
const item = (f: File, mime = f.type || 'application/octet-stream'): IngestItem =>
  ({ kind: 'file', mime, file: f });

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
  _resetSvgHandlerSeamsForTests();
  _resetImageHandlerSeamsForTests();
  __setSvgMeasureForTests(async () => ({ width: 400, height: 300 }));
  __setFileToDataUriForTests(async (f) => `data:${f.type || 'application/octet-stream'};base64,${f.name}`);
});

describe('isSvgFileItem / kitSvgHandler.match', () => {
  it('matches image/svg+xml files', () => {
    expect(isSvgFileItem(item(svgFile()))).toBe(true);
  });

  it('sniffs the .svg extension when the MIME is octet-stream (empty File.type)', () => {
    expect(isSvgFileItem(item(svgFile('logo.svg', '')))).toBe(true);
    expect(isSvgFileItem(item(svgFile('LOGO.SVG', '')))).toBe(true);
  });

  it('rejects non-svg files and string items', () => {
    expect(isSvgFileItem(item(svgFile('photo.png', ''), 'application/octet-stream'))).toBe(false);
    expect(isSvgFileItem({ kind: 'file', mime: 'image/png', file: svgFile('a.png', 'image/png') })).toBe(false);
    expect(isSvgFileItem({ kind: 'string', mime: 'image/svg+xml', text: '<svg/>' })).toBe(false);
  });

  it('outranks kit:image so svg files never reach the raster measure path', () => {
    expect(kitSvgHandler.priority!).toBeGreaterThan(kitImageHandler.priority!);
  });
});

describe('kitSvgHandler — default single-node embed', () => {
  it('inserts ONE image node, fit-clamped and centered on the point', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await kitSvgHandler.handle([item(svgFile())], c);
    expect(c.insert.commit).toHaveBeenCalledTimes(1);
    expect(c.insert.commit).toHaveBeenCalledWith(
      { x: -100, y: -50, width: 400, height: 300 },
      { kind: 'image', src: 'data:image/svg+xml;base64,pic.svg' },
    );
  });

  it('forces the image/svg+xml MIME onto the data URI for sniffed .svg files', async () => {
    const c = ctx({ point: { x: 0, y: 0 } });
    await kitSvgHandler.handle([item(svgFile('logo.svg', ''))], c);
    const [, extras] = c.insert.commit.mock.calls[0];
    expect(extras.src).toBe('data:image/svg+xml;base64,logo.svg');
  });

  it('prefers ctx.resolveSrc over the data-URI embed', async () => {
    const c = ctx({ point: { x: 0, y: 0 }, resolveSrc: async () => 'https://cdn/x.svg' });
    await kitSvgHandler.handle([item(svgFile())], c);
    expect(c.insert.commit.mock.calls[0][1]).toEqual({ kind: 'image', src: 'https://cdn/x.svg' });
  });

  it('a file that fails to measure is skipped with a warn; others proceed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let n = 0;
    __setSvgMeasureForTests(async () => {
      if (n++ === 0) throw new Error('bad svg');
      return { width: 10, height: 10 };
    });
    const c = ctx({ point: { x: 0, y: 0 } });
    await kitSvgHandler.handle([item(svgFile('bad.svg')), item(svgFile('ok.svg'))], c);
    expect(c.insert.commit).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});
