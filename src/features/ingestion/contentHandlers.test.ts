import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerContentHandler,
  getContentHandlers,
  runIngest,
  _resetContentHandlersForTests,
  type IngestCtx,
} from './contentHandlers';
import type { IngestItem } from './ingestItems';

const png: IngestItem = { kind: 'file', mime: 'image/png', file: new File(['x'], 'a.png', { type: 'image/png' }) };
const csv: IngestItem = { kind: 'file', mime: 'text/csv', file: new File(['x'], 'a.csv', { type: 'text/csv' }) };
const txt: IngestItem = { kind: 'string', mime: 'text/plain', text: 'hi' };

const ctx = { point: null } as unknown as IngestCtx;

beforeEach(() => _resetContentHandlersForTests());
afterEach(() => vi.restoreAllMocks());

describe('registerContentHandler', () => {
  it('returns a disposer that removes the entry', () => {
    const off = registerContentHandler({ id: 't', match: 'text/plain', handle: () => {} });
    expect(getContentHandlers().some((h) => h.id === 't')).toBe(true);
    off();
    expect(getContentHandlers().some((h) => h.id === 't')).toBe(false);
  });
});

describe('runIngest', () => {
  it('partitions items across handlers by priority; first match takes its items', async () => {
    const img = vi.fn();
    const rest = vi.fn();
    registerContentHandler({ id: 'img', match: 'image/*', priority: 10, handle: img });
    registerContentHandler({ id: 'any', match: () => true, priority: 0, handle: rest });
    await runIngest([png, csv, txt], ctx);
    expect(img).toHaveBeenCalledWith([png], ctx);
    expect(rest).toHaveBeenCalledWith([csv, txt], ctx);
  });

  it('supports string[] and predicate match forms', async () => {
    const h = vi.fn();
    registerContentHandler({ id: 'multi', match: ['text/csv', 'text/plain'], handle: h });
    await runIngest([png, csv, txt], ctx);
    expect(h).toHaveBeenCalledWith([csv, txt], ctx);
  });

  it('a throwing handler warns and does not block others', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = vi.fn();
    registerContentHandler({ id: 'boom', match: 'image/*', priority: 10, handle: () => { throw new Error('x'); } });
    registerContentHandler({ id: 'ok', match: 'text/plain', handle: ok });
    await runIngest([png, txt], ctx);
    expect(ok).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('a rejecting async handler warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerContentHandler({ id: 'rej', match: 'image/*', handle: async () => { throw new Error('x'); } });
    await runIngest([png], ctx);
    expect(warn).toHaveBeenCalled();
  });

  it('unmatched items are silently ignored (dwarn is debug-gated)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await runIngest([txt], ctx); // no handlers registered
    expect(warn).not.toHaveBeenCalled();
  });

  it('same-priority handlers keep registration order', async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerContentHandler({ id: 'first', match: 'image/*', handle: first });
    registerContentHandler({ id: 'second', match: 'image/*', handle: second });
    await runIngest([png], ctx);
    expect(first).toHaveBeenCalledWith([png], ctx);
    expect(second).not.toHaveBeenCalled();
  });
});
