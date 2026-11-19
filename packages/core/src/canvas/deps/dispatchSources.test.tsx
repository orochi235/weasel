import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { LongPressState } from '@weasel-js/routing';
import { useDispatchDepSources } from './dispatchSources';

function setup(kindOfNode: { current: ((id: string) => string | undefined) | undefined }) {
  let reg!: DepRegistry;
  function Wire() {
    useDispatchDepSources({} as LongPressState, undefined, kindOfNode);
    reg = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
  return () => reg;
}

describe('useDispatchDepSources', () => {
  it('publishes no kindOfNode while the canvas has no routing kinds, and the live one once it has', () => {
    const ref: { current: ((id: string) => string | undefined) | undefined } = { current: undefined };
    const reg = setup(ref);
    expect(reg().get('kindOfNode')).toBeUndefined();
    expect(reg().get('hitAt')).toBeUndefined();
    ref.current = (id) => (id === 'a' ? 'rect' : undefined);
    expect(reg().get('kindOfNode')?.('a')).toBe('rect');
  });
});
