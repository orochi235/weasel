import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useGeometryProjection } from './geometryProjection';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useGeometryProjection', () => {
  it('registers the geometryProjection dep and reads back the same projection', () => {
    const proj: GeometryProjection = { transform: (node, _m) => node.data };
    let reg!: DepRegistry;
    function Wire() {
      useGeometryProjection(proj);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect(reg.get('geometryProjection')).toBe(proj);
  });

  it('returns undefined when called with undefined (no-registration path)', () => {
    let reg!: DepRegistry;
    function Wire() {
      useGeometryProjection(undefined);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    // When projection is undefined the dep source returns undefined,
    // meaning the dep is not meaningfully registered.
    expect(reg.get('geometryProjection')).toBeUndefined();
  });
});
