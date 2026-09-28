import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { resizePolicyOptions, useResizePolicy } from './resizePolicy';
import type { ResizePolicy } from 'interactions/actions/depSchema';

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  onR(useDepRegistry());
  return null;
}

describe('useResizePolicy', () => {
  it('publishes the lifecycle options beside the constraints', () => {
    const onGestureStart = () => {};
    const onGestureEnd = () => {};
    let reg!: DepRegistry;
    function Wire() {
      useResizePolicy({ label: 'Stretch', transient: true, onGestureStart, onGestureEnd });
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
    expect(policy.onGestureStart).toBe(onGestureStart);
    expect(policy.onGestureEnd).toBe(onGestureEnd);
  });
});

describe('resizePolicyOptions', () => {
  it('maps every read UseResizeOptions field onto the policy options', () => {
    const behaviors = [{}];
    const pointSnapBehaviors = [{}];
    const expandIds = (ids: string[]) => ids;
    const onGestureStart = () => {};
    const onGestureEnd = () => {};
    expect(resizePolicyOptions({
      behaviors: behaviors as never,
      pointSnapBehaviors: pointSnapBehaviors as never,
      expandIds,
      resizeLabel: 'Stretch',
      transient: true,
      onGestureStart,
      onGestureEnd,
    })).toEqual({
      constraints: behaviors,
      pointSnap: pointSnapBehaviors,
      expandIds,
      label: 'Stretch',
      transient: true,
      onGestureStart,
      onGestureEnd,
    });
  });
});
