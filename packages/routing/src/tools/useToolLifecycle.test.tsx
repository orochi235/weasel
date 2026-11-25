import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Contribution } from '../contributions/types';
import { useToolLifecycle } from './useToolLifecycle';

describe('useToolLifecycle', () => {
  it('ends a tool redefined while live and starts its new definition', () => {
    const log: string[] = [];
    const def = (v: string) => ({
      id: 't',
      eligibility: { focus: true },
      bindings: [],
      onActivate: () => log.push(`on ${v}`),
      onDeactivate: () => log.push(`off ${v}`),
    }) as unknown as Contribution<unknown>;
    const { rerender, unmount } = renderHook(
      ({ tool }) => useToolLifecycle({ entriesById: new Map([['t', tool]]), active: 't', hotkeyStack: [] }),
      { initialProps: { tool: def('1') } },
    );
    rerender({ tool: def('2') });
    unmount();
    expect(log).toEqual(['on 1', 'off 1', 'on 2', 'off 2']);
  });
});
