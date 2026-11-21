import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DepRegistryProvider, useDepSource } from '@weasel-js/routing/react';
import type { Action, ActionItem, DepName } from '@weasel-js/routing';
import { useActionStates } from './useActionStates';

const action: Action = {
  id: 'gated',
  label: 'Gated',
  requires: ['gate' as DepName],
  invoker: { timing: 'immediate', run: () => {} },
  enabled: (deps) => (deps as Record<string, unknown> | undefined)?.gate as 'selection-required' | 'locked',
};

const item: ActionItem = { key: 'gated', action, label: 'Gated', tags: [] };

function Gate({ reason }: { reason: string }) {
  useDepSource('gate' as DepName, () => reason as never);
  return null;
}

function Reason() {
  const [state] = useActionStates([item]);
  return <span data-testid="reason">{state!.disabledReason}</span>;
}

it('catches up when a dep the same commit publishes changes only the reason', () => {
  const view = (reason: string) => (
    <DepRegistryProvider>
      <Reason />
      <Gate reason={reason} />
    </DepRegistryProvider>
  );
  const { rerender } = render(view('selection-required'));
  expect(screen.getByTestId('reason').textContent).toBe('selection-required');
  rerender(view('locked'));
  expect(screen.getByTestId('reason').textContent).toBe('locked');
});
