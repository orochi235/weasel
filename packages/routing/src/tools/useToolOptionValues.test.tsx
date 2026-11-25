import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryContext } from '../interactions/actions/depRegistry';
import { createDepRegistry } from '../interactions/actions/depNode';
import { createToolOptionValues } from './toolOptions';
import { useToolOptionValues } from './useToolOptionValues';

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
