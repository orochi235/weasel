import { describe, it, expect, vi } from 'vitest';
import { resolveRoute } from './lookup';
import type { RouteTable, ActionFn } from './types';
import type { HitResult } from './hitResult';
import { asNodeId } from '../../core/scene/types';

const noMods = { mod: false, shift: false, alt: false, ctrl: false, meta: false, space: false };

function nodeHit(kind: string): HitResult {
  return { category: 'node', kind, id: asNodeId('a'), pose: {}, data: {} };
}

describe('resolveRoute target precedence', () => {
  it('exact kind wins', () => {
    const exact = vi.fn();
    const base  = vi.fn();
    const star  = vi.fn();
    const table: RouteTable<void> = {
      'rect:selected': exact as ActionFn<void>,
      'rect':          base  as ActionFn<void>,
      '*':             star  as ActionFn<void>,
    };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(exact);
  });

  it('subkind wildcard beats base-kind', () => {
    const subWild = vi.fn();
    const base    = vi.fn();
    const table: RouteTable<void> = {
      '*:selected': subWild as ActionFn<void>,
      'rect':       base    as ActionFn<void>,
    };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(subWild);
  });

  it('base-kind falls back when no subkind wildcard', () => {
    const base = vi.fn();
    const table: RouteTable<void> = { 'rect': base as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(base);
  });

  it('universal * falls back last', () => {
    const star = vi.fn();
    const table: RouteTable<void> = { '*': star as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect:selected'), noMods)).toBe(star);
  });

  it('empty kind does not fall through to *', () => {
    const star = vi.fn();
    const table: RouteTable<void> = { '*': star as ActionFn<void> };
    const empty: HitResult = { category: 'empty', kind: 'empty' };
    expect(resolveRoute(table, empty, noMods)).toBeUndefined();
  });

  it('returns undefined when no match', () => {
    const table: RouteTable<void> = { 'text': vi.fn() as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect'), noMods)).toBeUndefined();
  });
});

describe('resolveRoute modifier sub-tables', () => {
  it('exact modifier combo wins', () => {
    const shiftAlt = vi.fn();
    const def      = vi.fn();
    const table: RouteTable<void> = {
      'rect': {
        default:     def      as ActionFn<void>,
        'shift+alt': shiftAlt as ActionFn<void>,
      },
    };
    expect(resolveRoute(table, nodeHit('rect'), { ...noMods, shift: true, alt: true })).toBe(shiftAlt);
  });

  it('falls back to default when no modifier match', () => {
    const def = vi.fn();
    const table: RouteTable<void> = {
      'rect': { default: def as ActionFn<void>, shift: vi.fn() as ActionFn<void> },
    };
    expect(resolveRoute(table, nodeHit('rect'), { ...noMods, alt: true })).toBe(def);
  });

  it('function-form route entry ignores modifiers', () => {
    const fn = vi.fn();
    const table: RouteTable<void> = { 'rect': fn as ActionFn<void> };
    expect(resolveRoute(table, nodeHit('rect'), { ...noMods, shift: true })).toBe(fn);
  });
});
