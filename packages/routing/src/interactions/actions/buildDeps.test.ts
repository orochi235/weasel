import { describe, expect, it, vi } from 'vitest';
import { createActionDeps } from './buildDeps';
import type { DepRegistry } from './depNode';

const registry = { get: (name: string) => ({ name }) } as unknown as DepRegistry;
const action = { id: 'act', label: 'Act', requires: ['history'] } as never;

describe('createActionDeps in dev', () => {
  it('lets the deps be serialized and compared, which probe members no action declares', () => {
    const deps = createActionDeps(action, registry);
    expect(JSON.stringify(deps)).toBe('{"history":{"name":"history"}}');
    expect(deps).toEqual({ history: { name: 'history' } });
    expect(String(deps)).toBe('[object Object]');
  });

  it('still throws on reading an undeclared dep', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = createActionDeps(action, registry) as Record<string, unknown>;
    expect(() => deps.selection).toThrow(/did not declare it/);
    warn.mockRestore();
  });
});
