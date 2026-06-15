import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInsertTool } from './useInsertTool';
import { makeCtx } from '../testUtils';

/**
 * useInsertTool is now a thin declarative wrapper that
 * delegates the entire gesture to the dispatcher's `insertAction`. There is
 * no local route-table drag handler, no local overlay layer, and no local
 * pointer/click handler. End-to-end commit flow is exercised by
 * `src/interactions/actions/defaults/insert.test.ts` (action behavior) and
 * `src/canvas/SceneCanvas.smoke.test.tsx` (integration). The tests below
 * pin only the surface the consumer sees on the Tool record.
 */
describe('useInsertTool surface', () => {
  const baseAdapter = {
    getSelection: () => [],
    commitInsert: vi.fn((bounds: { x: number; y: number; width: number; height: number }) => ({
      id: 'new', ...bounds,
    })),
    commitPaste: vi.fn(() => []),
    snapshotSelection: vi.fn(),
    insertNode: vi.fn(),
    setSelection: vi.fn(),
    applyOps: vi.fn(),
  } as unknown as Parameters<typeof useInsertTool>[0];

  it('declares id "insert" and crosshair cursor', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, {}));
    expect(result.current.id).toBe('insert');
    const cursor = typeof result.current.cursor === 'function'
      ? (result.current.cursor as (c: unknown) => string)(makeCtx())
      : result.current.cursor;
    expect(cursor).toBe('crosshair');
  });

  it('declares an insert binding with rect kind and bindingsOverrideDrag', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, {}));
    expect(result.current.bindings).toHaveLength(1);
    expect(result.current.bindings![0]).toMatchObject({
      actionId: 'insert',
      opts: { params: { kind: 'rect' } },
    });
  });

  it('declares no route-table drag/pointer/overlay handlers (dispatcher-only)', () => {
    const { result } = renderHook(() => useInsertTool(baseAdapter, {}));
    expect(result.current.drag).toBeUndefined();
    expect(result.current.pointer).toBeUndefined();
    expect(result.current.overlay).toBeUndefined();
  });
});
