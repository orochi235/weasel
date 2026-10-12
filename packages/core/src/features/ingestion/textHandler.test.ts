import { describe, it, expect, vi } from 'vitest';
import { createTextHandler, kitTextHandler } from './textHandler';
import { kitSvgHandler } from './svgHandler';
import { kitWeaselJsonHandler } from './weaselJsonHandler';
import type { IngestCtx } from './contentHandlers';
import type { IngestItem } from '@weasel-js/routing';

const text = (t: string, mime = 'text/plain'): IngestItem => ({ kind: 'string', mime, text: t });

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

/** 10 units per character of the longest line, 20 per line. */
const measure = (t: string): { width: number; height: number } => {
  const lines = t.split('\n');
  return { width: Math.max(...lines.map((l) => l.length)) * 10, height: lines.length * 20 };
};
const handler = createTextHandler({ measure });

describe('kitTextHandler', () => {
  it('matches plain-text strings only', () => {
    const m = kitTextHandler.match as (i: IngestItem) => boolean;
    expect(m(text('hello'))).toBe(true);
    expect(m(text('<b>hello</b>', 'text/html'))).toBe(false);
    expect(m(text('https://example.com', 'text/uri-list'))).toBe(false);
    expect(m({ kind: 'file', mime: 'text/plain', file: new File(['x'], 'a.txt') })).toBe(false);
  });

  it('runs after the handlers that read markup and node payloads out of plain text', () => {
    expect(kitTextHandler.priority!).toBeLessThan(kitSvgHandler.priority!);
    expect(kitTextHandler.priority!).toBeLessThan(kitWeaselJsonHandler.priority!);
  });

  it('inserts a text node sized to the string, centered on the point', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await handler.handle([text('hello')], c);
    expect(c.insert.commit).toHaveBeenCalledWith(
      { x: 75, y: 90, width: 50, height: 20 },
      { kind: 'text', text: 'hello' },
    );
  });

  it('centers on the viewport when there is no point', async () => {
    const c = ctx();
    await handler.handle([text('hello')], c);
    const [bounds] = c.insert.commit.mock.calls[0];
    expect(bounds.x + bounds.width / 2).toBeCloseTo(400);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(300);
  });

  it('keeps line breaks, as \\n, and drops the trailing ones', async () => {
    const c = ctx();
    await handler.handle([text('one\r\ntwo\n\n')], c);
    const [bounds, extras] = c.insert.commit.mock.calls[0];
    expect(extras).toEqual({ kind: 'text', text: 'one\ntwo' });
    expect(bounds.height).toBe(40);
  });

  it('inserts nothing for a string of whitespace', async () => {
    const c = ctx();
    await handler.handle([text('  \n\t')], c);
    expect(c.insert.commit).not.toHaveBeenCalled();
  });

  it('cascades several strings by a fixed offset', async () => {
    const c = ctx({ point: { x: 100, y: 100 } });
    await handler.handle([text('a'), text('b')], c);
    const [b0] = c.insert.commit.mock.calls[0];
    const [b1] = c.insert.commit.mock.calls[1];
    expect(b1.x - b0.x).toBe(24);
    expect(b1.y - b0.y).toBe(24);
  });
});
