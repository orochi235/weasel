/**
 * Assembly reads declared eligibility, so an entry lands in a scope tier
 * because of what it says about itself — not because of which argument the
 * consumer passed it in.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useContributions } from './useContributions';
import type { Contribution } from './types';
import { ActiveToolContextProvider } from '../interactions/actions/activeToolContext';
import { ActionsProvider, useAction, type Action } from '../interactions/actions/registry';

const rect: Contribution = {
  id: 'rect',
  eligibility: { focus: true },
  bindings: [{ spec: { kind: 'drag' }, actionId: 'insert' }],
};
const hud: Contribution = {
  id: 'weasel-hud',
  eligibility: { claimed: true },
  bindings: [{ spec: { kind: 'drag', target: { kindOf: () => true } }, actionId: 'hud.drag' }],
};

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveToolContextProvider>{children}</ActiveToolContextProvider>;
}

describe('useContributions', () => {
  it('scopes a focused entry active and a claimed entry ambient', () => {
    const { result } = renderHook(
      () => useContributions({ entries: [rect, hud], focused: 'rect' }),
      { wrapper },
    );
    const scoped = result.current.scopedBindings();
    expect(scoped.find((s) => s.ownerToolId === 'rect')?.scope).toBe('active');
    expect(scoped.find((s) => s.ownerToolId === 'weasel-hud')?.scope).toBe('ambient');
  });

  it('omits an unfocused focus-only entry entirely', () => {
    const { result } = renderHook(
      () => useContributions({ entries: [rect, hud], focused: 'other' }),
      { wrapper },
    );
    expect(result.current.scopedBindings().some((s) => s.ownerToolId === 'rect')).toBe(false);
  });
});

describe('route-conflict reporting sees action default bindings', () => {
  const collidingSpec = { kind: 'click', target: 'empty' } as const;

  const ambientEntry: Contribution = {
    id: 'ambient-entry',
    eligibility: { always: true },
    bindings: [{ spec: collidingSpec, actionId: 'entry.click' }],
  };

  const collidingAction: Action = {
    id: 'colliding.action',
    kind: 'immediate',
    deps: [],
    defaultBinding: collidingSpec,
    run: () => {},
  } as unknown as Action;

  function actionsWrapper({ children }: { children: ReactNode }) {
    return (
      <ActionsProvider>
        <ActiveToolContextProvider>{children}</ActiveToolContextProvider>
      </ActionsProvider>
    );
  }

  it('reports an entry binding that collides with an action default binding', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(
      () => {
        useAction(collidingAction);
        return useContributions({ entries: [ambientEntry], focused: 'select' });
      },
      { wrapper: actionsWrapper },
    );
    const messages = warn.mock.calls.map((args) => String(args[0]));
    const conflict = messages.find((m) => m.includes('route conflict'));
    warn.mockRestore();
    expect(conflict).toBeDefined();
    expect(conflict).toContain('ambient-entry');
    expect(conflict).toContain('colliding.action');
  });
});
