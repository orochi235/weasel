import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { DepRegistryContext } from '../interactions/actions/depRegistry';
import { createDepRegistry } from '../interactions/actions/depNode';
import { createToolOptionValues, type ToolOptionsSpec, type ToolOptionValues } from './toolOptions';
import { useCanvasToolOptionValues, useToolOptionParams, useToolOptionValues } from './useToolOptionValues';

function Publish({ values }: { values: ReturnType<typeof createToolOptionValues> }) {
  useToolOptionValues(values);
  return null;
}

describe('useToolOptionValues', () => {
  it('publishes the store as the toolOptionValues dep', () => {
    const registry = createDepRegistry();
    const values = createToolOptionValues();
    const { unmount } = render(<DepRegistryContext.Provider value={registry}><Publish values={values} /></DepRegistryContext.Provider>);
    expect(registry.get('toolOptionValues')).toBe(values);
    unmount();
    expect(registry.get('toolOptionValues')).toBeUndefined();
  });

  it('does nothing outside a dep registry', () => {
    expect(() => render(<Publish values={createToolOptionValues()} />)).not.toThrow();
  });
});

function Canvas({ values, child, childKey }: { values?: ReturnType<typeof createToolOptionValues>; child: ReturnType<typeof createToolOptionValues>; childKey: string }) {
  useCanvasToolOptionValues(values);
  return <Publish key={childKey} values={child} />;
}

describe('useCanvasToolOptionValues', () => {
  it("answers the canvas's values over a child's store, before and after the child remounts", () => {
    const registry = createDepRegistry();
    const values = createToolOptionValues();
    const child = createToolOptionValues();
    const tree = (key: string, v = values) => (
      <DepRegistryContext.Provider value={registry}><Canvas values={v} child={child} childKey={key} /></DepRegistryContext.Provider>
    );
    const { rerender } = render(tree('a'));
    expect(registry.get('toolOptionValues')).toBe(values);
    rerender(tree('b'));
    expect(registry.get('toolOptionValues')).toBe(values);
  });

  it("answers a child's store when the canvas is given none", () => {
    const registry = createDepRegistry();
    const child = createToolOptionValues();
    render(<DepRegistryContext.Provider value={registry}><Canvas child={child} childKey="a" /></DepRegistryContext.Provider>);
    expect(registry.get('toolOptionValues')).toBe(child);
  });
});

class ClassValues implements ToolOptionValues {
  private readonly listeners = new Set<() => void>();
  private readonly byOwner = new Map<string, Readonly<Record<string, unknown>>>();
  get(owner: string) { return this.byOwner.get(owner) ?? {}; }
  set(owner: string, key: string, value: unknown) {
    this.byOwner.set(owner, { ...this.get(owner), [key]: value });
    for (const l of this.listeners) l();
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

describe('useToolOptionParams', () => {
  it('subscribes through a store whose methods read `this`', () => {
    const values = new ClassValues();
    const options: ToolOptionsSpec = {
      actionId: 'pen',
      prefs: { name: 'Pen', description: '', children: { width: { kind: 'number', name: 'Width', description: '', default: 1 } } },
    };
    const tool = { id: 'pen', options };
    const { result } = renderHook(() => useToolOptionParams(tool, values));
    expect(result.current).toEqual({ width: 1 });
    act(() => values.set('pen', 'width', 4));
    expect(result.current).toEqual({ width: 4 });
  });
});
