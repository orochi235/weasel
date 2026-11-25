import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryContext } from '../interactions/actions/depRegistry';
import { createDepRegistry } from '../interactions/actions/depNode';
import { createToolOptionValues } from './toolOptions';
import { useCanvasToolOptionValues, useToolOptionValues } from './useToolOptionValues';

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
