import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
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

  it('carries the drop-target mode, following the latest render', () => {
    let reg!: DepRegistry;
    function Wire({ mode }: { mode?: 'topmost' | 'region' }) {
      useLayoutDepSource(undefined, mode);
      return null;
    }
    const tree = (mode?: 'topmost' | 'region') => (
      <DepRegistryProvider>
        <Wire mode={mode} />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>
    );
    const { rerender } = render(tree());
    expect(reg.get('layout')?.dropTarget).toBeUndefined();
    rerender(tree('topmost'));
    expect(reg.get('layout')?.dropTarget).toBe('topmost');
    rerender(tree('region'));
    expect(reg.get('layout')?.dropTarget).toBe('region');
  });
});
