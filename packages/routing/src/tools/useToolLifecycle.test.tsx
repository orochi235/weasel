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

  it('ends a tool that left the registry while active once, not again when the slot moves on', () => {
    const tool = (id: string) => ({ id, eligibility: { focus: true }, bindings: [] }) as unknown as Contribution<unknown>;
    let switches = 0;
    const onSwitch = () => { switches++; };
    const both = new Map([['t', tool('t')], ['u', tool('u')]]);
    const onlyU = new Map([['u', tool('u')]]);
    const { rerender } = renderHook(
      ({ entries, active }) => useToolLifecycle({ entriesById: entries, active, hotkeyStack: [], onSwitch }),
      { initialProps: { entries: both, active: 't' as string | null } },
    );
    rerender({ entries: onlyU, active: 't' });
    expect(switches).toBe(1);
    rerender({ entries: onlyU, active: 't' });
    rerender({ entries: onlyU, active: null });
    expect(switches).toBe(1);
    rerender({ entries: onlyU, active: 'u' });
    rerender({ entries: both, active: 't' });
    expect(switches).toBe(2);
    rerender({ entries: both, active: 'u' });
    expect(switches).toBe(3);
  });
});
