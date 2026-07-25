import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { kitWeaselJsonHandler } from './weaselJsonHandler';
import { kitSvgHandler } from './svgHandler';
import { kitImageHandler } from './imageHandler';
import {
  registerContentHandler,
  runIngest,
  _resetContentHandlersForTests,
  type IngestCtx,
} from './contentHandlers';
import type { IngestItem } from './ingestItems';
import {
  WEASEL_CLIPBOARD_MIME,
  WEASEL_CLIPBOARD_MIME_WEB,
  buildWeaselClipboardText,
} from 'interactions/actions/clipboard/wireFormat';

const NODES = [
  { id: 'a', parent: null, pose: { x: 1, y: 2 }, data: { fill: '#f00' } },
  { id: 'b', parent: 'a', pose: { x: 0, y: 0 }, data: {} },
];

const stringItem = (text: string, mime = WEASEL_CLIPBOARD_MIME): IngestItem =>
  ({ kind: 'string', mime, text });

const matches = (item: IngestItem): boolean =>
  (kitWeaselJsonHandler.match as (item: IngestItem) => boolean)(item);

/** Stub `InsertAdapter` whose commitPaste mints `paste-N` ids. */
function stubAdapter() {
  return {
    insertNode: vi.fn(),
    setSelection: vi.fn(),
    getSelection: () => [],
    getPasteOffset: vi.fn(() => ({ dx: 12, dy: 12 })),
    commitPaste: vi.fn((
      clipboard: { items: unknown[] },
      _offset?: { dx: number; dy: number },
      _ctx?: { dropPoint?: { worldX: number; worldY: number } },
    ) => clipboard.items.map((n, i) => ({ ...(n as object), id: `paste-${i}` }))),
  };
}

type TestCtx = IngestCtx & {
  applyOps: Mock;
  selection: { get: Mock; set: Mock };
};

function ctx(overrides: Partial<IngestCtx> = {}): TestCtx {
  return {
    point: null,
    viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    insert: { commit: vi.fn() },
    applyOps: vi.fn(),
    scene: {} as never,
    selection: { get: vi.fn(() => ['old']), set: vi.fn() },
    deps: {},
    ...overrides,
  } as never;
}

beforeEach(() => {
  _resetContentHandlersForTests();
});

describe('kitWeaselJsonHandler.match', () => {
  it('matches the custom MIME', () => {
    expect(matches(stringItem('anything', WEASEL_CLIPBOARD_MIME))).toBe(true);
  });

  it('matches the web-prefixed Chromium spelling', () => {
    expect(matches(stringItem('anything', WEASEL_CLIPBOARD_MIME_WEB))).toBe(true);
  });

  it('matches text/plain carrying a sniffable weasel payload', () => {
    expect(matches(stringItem(buildWeaselClipboardText(NODES), 'text/plain'))).toBe(true);
  });

  it('declines non-weasel text/plain', () => {
    expect(matches(stringItem('just some prose', 'text/plain'))).toBe(false);
    expect(matches(stringItem('{"nodes":[]}', 'text/plain'))).toBe(false);
    expect(matches(stringItem('{"weaselClipboard":2,"nodes":[]}', 'text/plain'))).toBe(false);
  });

  it('sits above the other kit handlers and below consumer default 0', () => {
    expect(kitWeaselJsonHandler.priority).toBe(-50);
    expect(kitWeaselJsonHandler.priority!).toBeGreaterThan(kitSvgHandler.priority!);
    expect(kitWeaselJsonHandler.priority!).toBeGreaterThan(kitImageHandler.priority!);
    expect(kitWeaselJsonHandler.priority!).toBeLessThan(0);
  });
});

describe('kitWeaselJsonHandler.handle — paste', () => {
  it('commits the paste through ctx.clipboard.adapter and applies insert + selection ops', async () => {
    const adapter = stubAdapter();
    const c = ctx({ clipboard: { adapter } });
    await kitWeaselJsonHandler.handle([stringItem(buildWeaselClipboardText(NODES))], c);

    expect(adapter.commitPaste).toHaveBeenCalledTimes(1);
    expect(adapter.commitPaste).toHaveBeenCalledWith({ items: NODES }, { dx: 12, dy: 12 });
    // ctx.point is null for paste — no dropPoint ctx is threaded.
    expect(adapter.commitPaste.mock.calls[0][2]).toBeUndefined();

    expect(c.applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = c.applyOps.mock.calls[0];
    expect(label).toBe('Paste');
    expect(ops).toHaveLength(3);
    expect(ops[0].name).toBe('insert');
    expect(ops[0].args.node.id).toBe('paste-0');
    expect(ops[1].name).toBe('insert');
    expect(ops[1].args.node.id).toBe('paste-1');
    expect(ops[2].name).toBe('setSelection');
    expect(ops[2].args).toMatchObject({ from: ['old'], to: ['paste-0', 'paste-1'] });

    expect(c.selection.set).toHaveBeenCalledWith(['paste-0', 'paste-1']);
  });

  it('falls back to a zero offset when the adapter has no getPasteOffset', async () => {
    const adapter = stubAdapter();
    (adapter as { getPasteOffset?: unknown }).getPasteOffset = undefined;
    const c = ctx({ clipboard: { adapter } });
    await kitWeaselJsonHandler.handle([stringItem(buildWeaselClipboardText(NODES))], c);
    expect(adapter.commitPaste).toHaveBeenCalledWith({ items: NODES }, { dx: 0, dy: 0 });
  });

  it('threads ctx.clipboard.reviver into the payload parse', async () => {
    const adapter = stubAdapter();
    const reviver = (_k: string, v: unknown) =>
      v && typeof v === 'object' && '$f32' in (v as object)
        ? new Float32Array((v as { $f32: number[] }).$f32) : v;
    const c = ctx({ clipboard: { adapter, reviver } });
    const text = buildWeaselClipboardText([{ id: 'a', buf: { $f32: [1, 2] } }]);
    await kitWeaselJsonHandler.handle([stringItem(text)], c);
    const snapshot = adapter.commitPaste.mock.calls[0][0] as { items: Array<{ buf: unknown }> };
    expect(snapshot.items[0].buf).toBeInstanceOf(Float32Array);
  });

  it('does nothing when commitPaste creates no nodes', async () => {
    const adapter = stubAdapter();
    adapter.commitPaste.mockReturnValue([]);
    const c = ctx({ clipboard: { adapter } });
    await kitWeaselJsonHandler.handle([stringItem(buildWeaselClipboardText(NODES))], c);
    expect(c.applyOps).not.toHaveBeenCalled();
    expect(c.selection.set).not.toHaveBeenCalled();
  });
});

describe('kitWeaselJsonHandler — declines', () => {
  it('declines a corrupt payload on the custom MIME without acting', async () => {
    const adapter = stubAdapter();
    const c = ctx({ clipboard: { adapter } });
    await kitWeaselJsonHandler.handle([stringItem('{"weaselClipboard":1}')], c);
    expect(adapter.commitPaste).not.toHaveBeenCalled();
    expect(c.applyOps).not.toHaveBeenCalled();
    expect(c.selection.set).not.toHaveBeenCalled();
  });

  it('declines when ctx.clipboard is absent', async () => {
    const c = ctx();
    await kitWeaselJsonHandler.handle([stringItem(buildWeaselClipboardText(NODES))], c);
    expect(c.applyOps).not.toHaveBeenCalled();
    expect(c.selection.set).not.toHaveBeenCalled();
  });
});

describe('kitWeaselJsonHandler — runIngest consumption semantics', () => {
  it('non-weasel text/plain stays available to a lower-priority handler', async () => {
    const spy = vi.fn();
    registerContentHandler(kitWeaselJsonHandler);
    registerContentHandler({ id: 'test:text', match: 'text/plain', priority: -200, handle: spy });
    const c = ctx({ clipboard: { adapter: stubAdapter() } });
    const item = stringItem('just some prose', 'text/plain');
    await runIngest([item], c);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual([item]);
    expect(c.applyOps).not.toHaveBeenCalled();
  });

  it('consumes a weasel text/plain payload so lower handlers never double-ingest it', async () => {
    const spy = vi.fn();
    registerContentHandler(kitWeaselJsonHandler);
    registerContentHandler({ id: 'test:text', match: 'text/plain', priority: -200, handle: spy });
    const c = ctx({ clipboard: { adapter: stubAdapter() } });
    await runIngest([stringItem(buildWeaselClipboardText(NODES), 'text/plain')], c);
    expect(spy).not.toHaveBeenCalled();
    expect(c.applyOps).toHaveBeenCalledTimes(1);
  });
});
