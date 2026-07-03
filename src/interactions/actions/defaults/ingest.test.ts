import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestAction } from './ingest';
import { registerContentHandler, _resetContentHandlersForTests } from 'features/ingestion/contentHandlers';
import type { IngestItem } from 'features/ingestion/ingestItems';

const png: IngestItem = { kind: 'file', mime: 'image/png', file: new File(['x'], 'a.png', { type: 'image/png' }) };

function deps() {
  return {
    scene: {} as never,
    selection: {} as never,
    insert: { commit: vi.fn() },
    applyOps: vi.fn(),
    ingestion: { viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }) },
  };
}

function runIngestAction(d: unknown, params?: Record<string, unknown>) {
  if (ingestAction.invoker?.timing !== 'immediate') throw new Error('expected immediate invoker');
  ingestAction.invoker.run(d as never, params);
}

beforeEach(() => _resetContentHandlersForTests());

describe('ingestAction', () => {
  it('routes params.items through the handler registry with a point', async () => {
    const handle = vi.fn();
    registerContentHandler({ id: 't', match: 'image/*', handle });
    runIngestAction(deps(), { items: [png], worldX: 10, worldY: 20 });
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    const [items, ctx] = handle.mock.calls[0];
    expect(items).toEqual([png]);
    expect(ctx.point).toEqual({ x: 10, y: 20 });
  });

  it('point is null when the event carried none (paste)', async () => {
    const handle = vi.fn();
    registerContentHandler({ id: 't', match: 'image/*', handle });
    runIngestAction(deps(), { items: [png] });
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    expect(handle.mock.calls[0][1].point).toBeNull();
  });

  it('ctx.viewportWorldRect and resolveSrc read through the ingestion dep', async () => {
    const handle = vi.fn();
    registerContentHandler({ id: 't', match: 'image/*', handle });
    const resolveSrc = async () => 'x';
    const d = deps();
    (d.ingestion as Record<string, unknown>).resolveSrc = resolveSrc;
    runIngestAction(d, { items: [png] });
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    const ctx = handle.mock.calls[0][1];
    expect(ctx.viewportWorldRect()).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(ctx.resolveSrc).toBe(resolveSrc);
  });

  it('no-ops without items or without the ingestion dep', () => {
    expect(() => runIngestAction(deps(), undefined)).not.toThrow();
    expect(() => runIngestAction({}, { items: [png] })).not.toThrow();
  });

  it('defaultBinding: drop + paste, both with all-optional modifiers', () => {
    const bindings = ingestAction.defaultBinding as Array<{ kind: string; mods?: Record<string, string> }>;
    const kinds = bindings.map((b) => b.kind).sort();
    expect(kinds).toEqual(['drop', 'paste']);
    for (const b of bindings) {
      expect(b.mods).toEqual({ alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' });
    }
  });
});
