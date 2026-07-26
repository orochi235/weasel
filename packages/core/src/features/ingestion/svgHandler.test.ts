import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  kitSvgHandler,
  isSvgFileItem,
  sniffSvgText,
  __setSvgMeasureForTests,
  _resetSvgHandlerSeamsForTests,
} from './svgHandler';
import {
  kitImageHandler,
  __setFileToDataUriForTests,
  _resetImageHandlerSeamsForTests,
} from './imageHandler';
import { kitWeaselJsonHandler } from './weaselJsonHandler';
import {
  registerContentHandler,
  runIngest,
  _resetContentHandlersForTests,
  type IngestCtx,
} from './contentHandlers';
import type { IngestItem } from './ingestItems';
import {
  WEASEL_CLIPBOARD_MIME,
  buildWeaselClipboardText,
} from 'interactions/actions/clipboard/wireFormat';

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
  _resetContentHandlersForTests();
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

// ─── text/plain SVG fallback flavor ─────────────────────────────────────────
// Safari drops custom MIMEs AND image/svg+xml from async clipboard writes, so
// a paste of draw's flavor set can arrive as text/plain SVG markup only.

const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
const svgTextItem = (text = SVG_TEXT): IngestItem =>
  ({ kind: 'string', mime: 'text/plain', text });
const matches = (i: IngestItem): boolean =>
  (kitSvgHandler.match as (i: IngestItem) => boolean)(i);

/** Ctx with the weasel-paste seam wired (or not) plus selection mocks, for
 *  precedence tests that run BOTH kit handlers through real runIngest. */
function pasteCtx(withClipboard: boolean) {
  const adapter = {
    insertNode: vi.fn(),
    setSelection: vi.fn(),
    getSelection: () => [] as string[],
    getPasteOffset: () => ({ dx: 12, dy: 12 }),
    commitPaste: vi.fn((cb: { items: unknown[] }) =>
      cb.items.map((n, i) => ({ ...(n as object), id: `paste-${i}` }))),
  };
  const c = ctx({
    selection: { get: vi.fn(() => []), set: vi.fn() } as never,
    ...(withClipboard ? { clipboard: { adapter } } : {}),
  });
  return { c, adapter };
}

const weaselItem = (): IngestItem => ({
  kind: 'string',
  mime: WEASEL_CLIPBOARD_MIME,
  text: buildWeaselClipboardText([{ id: 'a', parent: null, pose: { x: 1 }, data: {} }]),
});

describe('sniffSvgText', () => {
  it('accepts a bare <svg> prefix (leading whitespace ok)', () => {
    expect(sniffSvgText(SVG_TEXT)).toBe(true);
    expect(sniffSvgText('  \n<svg>')).toBe(true);
    expect(sniffSvgText('<svg/>')).toBe(true);
  });

  it('accepts an XML declaration and comments before <svg>', () => {
    expect(sniffSvgText('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="x">')).toBe(true);
    expect(sniffSvgText('<?xml version="1.0"?>\n<!-- exported -->\n<svg>')).toBe(true);
  });

  it('accepts the canonical Illustrator-style DOCTYPE preamble; rejects HTML doctypes', () => {
    expect(sniffSvgText(
      '<?xml version="1.0" encoding="utf-8"?>\n'
      + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n'
      + '<svg version="1.1" xmlns="http://www.w3.org/2000/svg">',
    )).toBe(true);
    expect(sniffSvgText('<!DOCTYPE svg>\n<svg>')).toBe(true);
    expect(sniffSvgText('<!DOCTYPE html>\n<html><body>hi</body></html>')).toBe(false);
  });

  it('rejects prose, mid-document mentions, JSON, and near-miss tags', () => {
    expect(sniffSvgText('plain prose')).toBe(false);
    expect(sniffSvgText('prose mentioning <svg> later')).toBe(false);
    expect(sniffSvgText('{"weaselClipboard":1,"nodes":[]}')).toBe(false);
    expect(sniffSvgText('<svgg>')).toBe(false);
    expect(sniffSvgText('<div><svg></div>')).toBe(false);
  });
});

describe('kitSvgHandler — text/plain SVG fallback', () => {
  it('matches text/plain carrying SVG markup; declines prose and weasel JSON', () => {
    expect(matches(svgTextItem())).toBe(true);
    expect(matches(svgTextItem('plain prose'))).toBe(false);
    // Weasel wire text is JSON — never claimed by the SVG branch, whether or
    // not the weasel handler is registered.
    expect(matches(svgTextItem(buildWeaselClipboardText([{ id: 'a' }])))).toBe(false);
  });

  it('ingests a text/plain SVG item through the same path as an SVG file', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await kitSvgHandler.handle([svgTextItem()], c);
    expect(c.insert.commit).toHaveBeenCalledTimes(1);
    const [, extras] = c.insert.commit.mock.calls[0];
    expect(extras.kind).toBe('image');
    expect(extras.src).toMatch(/^data:image\/svg\+xml/);
  });

  it('does NOT double-paste: weasel-JSON wins when both flavors arrive in one event', async () => {
    registerContentHandler(kitWeaselJsonHandler);
    registerContentHandler(kitSvgHandler);
    const { c } = pasteCtx(true);
    await runIngest([weaselItem(), svgTextItem()], c);
    expect(c.applyOps).toHaveBeenCalledTimes(1); // the weasel paste
    expect(c.insert.commit).not.toHaveBeenCalled(); // svg fallback declined
  });

  it('the SVG text flavor still ingests when the weasel handler declines (clipboard not wired)', async () => {
    registerContentHandler(kitWeaselJsonHandler);
    registerContentHandler(kitSvgHandler);
    const { c } = pasteCtx(false);
    await runIngest([weaselItem(), svgTextItem()], c);
    expect(c.applyOps).not.toHaveBeenCalled(); // weasel declined inert
    expect(c.insert.commit).toHaveBeenCalledTimes(1); // fallback flavor lands
  });
});
