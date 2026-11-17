import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { resizePolicyOptions, useResizePolicy } from './resizePolicy';
import type { ResizePolicy } from '@weasel-js/core/engine';

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  onR(useDepRegistry());
  return null;
}

describe('useResizePolicy', () => {
  it('publishes the lifecycle options beside the constraints', () => {
    const onRunStart = () => {};
    const onRunEnd = () => {};
    let reg!: DepRegistry;
    function Wire() {
      useResizePolicy({ label: 'Stretch', transient: true, onRunStart, onRunEnd });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const policy = reg.get('resizePolicy') as ResizePolicy<unknown>;
    expect(policy.label).toBe('Stretch');
    expect(policy.transient).toBe(true);
    expect(policy.onRunStart).toBe(onRunStart);
    expect(policy.onRunEnd).toBe(onRunEnd);
  });
});

describe('resizePolicyOptions', () => {
  it('maps every read ResizeOptions field onto the policy options', () => {
    const behaviors = [{}];
    const expandIds = (ids: string[]) => ids;
    const onRunStart = () => {};
    const onRunEnd = () => {};
    expect(resizePolicyOptions({
      behaviors: behaviors as never,
      expandIds,
      resizeLabel: 'Stretch',
      transient: true,
      onRunStart,
      onRunEnd,
    })).toEqual({
      constraints: behaviors,
      expandIds,
      label: 'Stretch',
      transient: true,
      onRunStart,
      onRunEnd,
    });
  });
});
