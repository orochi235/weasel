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
  it('returns a disposer that removes the entry; double-call is safe', () => {
    const off = registerContentHandler({ id: 't', match: 'text/plain', handle: () => {} });
    expect(getContentHandlers().some((h) => h.id === 't')).toBe(true);
    off();
    expect(getContentHandlers().some((h) => h.id === 't')).toBe(false);
    // Register a second handler to verify the second off() doesn't remove it via a stale splice index.
    const off2 = registerContentHandler({ id: 'u', match: 'text/plain', handle: () => {} });
    off(); // second call — must be a no-op
    expect(getContentHandlers().some((h) => h.id === 'u')).toBe(true);
    off2();
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

  it('a throwing match predicate warns and treats item as non-match; later handler still receives it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = vi.fn();
    registerContentHandler({
      id: 'boom-pred',
      priority: 10,
      match: () => { throw new Error('predicate exploded'); },
      handle: vi.fn(),
    });
    registerContentHandler({ id: 'fallback', priority: 0, match: 'image/*', handle: ok });
    await runIngest([png], ctx);
    expect(ok).toHaveBeenCalledWith([png], ctx);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"boom-pred" match predicate threw'),
      expect.any(Error),
    );
  });

  it('handlers run concurrently (deadlocks under sequential execution)', async () => {
    // Handler A awaits a deferred that handler B resolves synchronously on its
    // own items. If handlers ran sequentially A would never get its resolution.
    let resolveDeferred!: () => void;
    const deferred = new Promise<void>((res) => { resolveDeferred = res; });

    registerContentHandler({
      id: 'waiter',
      priority: 10,
      match: 'image/*',
      handle: async () => { await deferred; },
    });
    registerContentHandler({
      id: 'resolver',
      priority: 0,
      match: 'text/plain',
      handle: () => { resolveDeferred(); },
    });

    // Under concurrent execution this completes; under sequential it times out.
    await runIngest([png, txt], ctx);
  });
});
