import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ActionsRegistry } from '@weasel-js/routing';
import type { InsertAdapter } from 'core/adapters/types';
import { getContentHandlers } from './contentHandlers';
import { useCanvasIngestion, type CanvasIngestionOptions } from './useCanvasIngestion';
import { rootsTree } from 'core/adapters/testing/rootsTree';

type Adapter = InsertAdapter<{ id: string }>;

const pasting: Adapter = {
  ...rootsTree(),
  insertNode: () => {}, setSelection: () => {}, getSelection: () => [], commitPaste: () => [],
};
const { commitPaste: _commitPaste, ...notPasting } = pasting;

function registryStub(ran = true) {
  const trigger = vi.fn(() => ran);
  return { registry: { trigger } as unknown as ActionsRegistry, trigger };
}

function mount(opts: {
  adapter?: Adapter;
  registry?: ActionsRegistry | null;
  options?: CanvasIngestionOptions;
} = {}) {
  const { adapter = pasting, registry = null } = opts;
  return renderHook(
    ({ options }: { options?: CanvasIngestionOptions }) =>
      useCanvasIngestion(adapter, () => registry, options),
    { initialProps: { options: opts.options } },
  );
}

const TEXT = { kind: 'string', mime: 'text/plain', text: 'hi' } as const;

describe('useCanvasIngestion: ingest', () => {
  it('hands nothing on, and reports false, while there is no registry', () => {
    const { result } = mount({ registry: null });
    expect(result.current.ingest([TEXT])).toBe(false);
  });

  it('answers false for an empty list without asking for the registry', () => {
    const getRegistry = vi.fn(() => null);
    const { result } = renderHook(() => useCanvasIngestion(pasting, getRegistry, undefined));
    expect(result.current.ingest([])).toBe(false);
    expect(getRegistry).not.toHaveBeenCalled();
  });

  it('triggers the ingest action with the items, turning a File into an item', () => {
    const { registry, trigger } = registryStub();
    const { result } = mount({ registry });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(result.current.ingest([file], { x: 3, y: 4 })).toBe(true);
    expect(trigger).toHaveBeenCalledWith('ingest', {
      items: [expect.objectContaining({ kind: 'file', file })], worldX: 3, worldY: 4,
    });
    result.current.ingest([TEXT]);
    expect(trigger).toHaveBeenLastCalledWith('ingest', { items: [TEXT] });
  });

  it('reports what the trigger reports', () => {
    const { result } = mount({ registry: registryStub(false).registry });
    expect(result.current.ingest([TEXT])).toBe(false);
  });

  it('keeps one ingest function across renders', () => {
    const { result, rerender } = mount({ options: {} });
    const first = result.current.ingest;
    rerender({ options: { clipboard: { enabled: false } } });
    expect(result.current.ingest).toBe(first);
  });
});

describe('useCanvasIngestion: clipboard', () => {
  it('is the adapter and the reviver', () => {
    const reviver = (_k: string, v: unknown) => v;
    const { result } = mount({ options: { clipboard: { reviver } } });
    expect(result.current.clipboard?.adapter).toBe(pasting);
    expect(result.current.clipboard?.reviver).toBe(reviver);
  });

  it('is absent when disabled, or when the adapter cannot commit a paste', () => {
    expect(mount({ options: { clipboard: { enabled: false } } }).result.current.clipboard).toBeUndefined();
    expect(mount({ adapter: notPasting }).result.current.clipboard).toBeUndefined();
  });

  it('calls the latest onOmitted without being rebuilt for it', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = mount({ options: { clipboard: { onOmitted: first } } });
    const ctx = result.current.clipboard;
    rerender({ options: { clipboard: { onOmitted: second } } });
    expect(result.current.clipboard).toBe(ctx);
    ctx!.onOmitted!([]);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith([]);
  });
});

describe('useCanvasIngestion: handlers', () => {
  it('registers the kit handlers and the canvas’s own, and takes its own back on unmount', () => {
    const idsNow = () => getContentHandlers().map((h) => h.id);
    const before = idsNow();
    const entry = { id: 'app:x', match: 'application/x', handle: () => {} };
    const { unmount } = mount({ options: { handlers: [entry] } });
    expect(idsNow()).toContain('app:x');
    expect(idsNow()).toContain('kit:image');
    unmount();
    expect(idsNow()).toEqual(before);
    expect(before).not.toContain('app:x');
  });
});
