import { describe, it, expect } from 'vitest';
import { findScopedConflicts } from './conflicts';
import type { Tool } from '../../types';

const tool = (id: string, spec: unknown, eligibility: unknown = { focus: true }): Tool =>
  ({ id, eligibility, bindings: [{ spec, actionId: `${id}.run` }] } as unknown as Tool);
const hotkey = (id: string, spec: unknown) => ({
  id, label: id, scope: 'hotkey', defaultBinding: spec, invoker: { timing: 'immediate', run: () => {} },
} as never);
const shadowsOf = (c: ReturnType<typeof findScopedConflicts>) => c.filter((x) => x.shadows).map((x) => x.ownerIds.join(','));

describe('findScopedConflicts — a hotkey action over a lower tier', () => {
  it('reports it shadowing an ambient tool, as it does a registry one', () => {
    const escape = { kind: 'key', key: 'Escape' };
    expect(shadowsOf(findScopedConflicts({ registry: [], ambient: [tool('esc', escape)], actions: [hotkey('open', escape)] }))).toEqual(['open,esc']);
  });

  it('reports it shadowing an ungated ambient action', () => {
    const escape = { kind: 'key', key: 'Escape' };
    const ambientAction = { id: 'leave', label: 'leave', defaultBinding: escape, invoker: { timing: 'immediate', run: () => {} } } as never;
    expect(shadowsOf(findScopedConflicts({ registry: [], actions: [hotkey('open', escape), ambientAction] }))).toEqual(['open,leave']);
  });
});
