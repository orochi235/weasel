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

  it('reports an untargeted click over a tool\'s click on `empty`', () => {
    const c = findScopedConflicts({ registry: [tool('t', { kind: 'click', target: 'empty' })], actions: [hotkey('pick', { kind: 'click' })] });
    expect(shadowsOf(c)).toEqual(['pick,t']);
  });

  it('reports a bare key over a tool\'s key with an optional Shift', () => {
    const c = findScopedConflicts({ registry: [tool('t', { kind: 'key', key: 'x', mods: { shift: 'optional' } })], actions: [hotkey('h', { kind: 'key', key: 'x' })] });
    expect(shadowsOf(c)).toEqual(['h,t']);
  });

  it('reports a required Shift over a tool\'s optional one', () => {
    const c = findScopedConflicts({ registry: [tool('t', { kind: 'key', key: 'x', mods: { shift: 'optional' } })], actions: [hotkey('h', { kind: 'key', key: 'x', mods: { shift: true } })] });
    expect(shadowsOf(c)).toEqual(['h,t']);
  });

  it('says nothing where no press meets both', () => {
    const c = findScopedConflicts({
      registry: [tool('t', { kind: 'key', key: 'x', mods: { shift: true } }), tool('u', { kind: 'click', target: 'empty' })],
      actions: [hotkey('h', { kind: 'key', key: 'x' }), hotkey('k', { kind: 'click', target: 'selected-body' })],
    });
    expect(c).toEqual([]);
  });
});
