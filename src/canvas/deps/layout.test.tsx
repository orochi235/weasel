import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useLayoutDepSource } from './layout';
import { freeform } from '../../layout/strategies';

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useLayoutDepSource', () => {
  it('resolves a static map by container id', () => {
    const ff = freeform<unknown>();
    let reg!: DepRegistry;
    function Wire() {
      useLayoutDepSource({ C: ff });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('layout')?.getLayout('C')).toBe(ff);
    expect(reg.get('layout')?.getLayout('missing')).toBeNull();
  });

  it('resolves a resolver function', () => {
    const ff = freeform<unknown>();
    let reg!: DepRegistry;
    function Wire() {
      useLayoutDepSource((id) => (id === 'X' ? ff : null));
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('layout')?.getLayout('X')).toBe(ff);
    expect(reg.get('layout')?.getLayout('Y')).toBeNull();
  });

  it('returns null for every container when layouts is undefined', () => {
    let reg!: DepRegistry;
    function Wire() {
      useLayoutDepSource(undefined);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('layout')?.getLayout('C')).toBeNull();
  });
});
