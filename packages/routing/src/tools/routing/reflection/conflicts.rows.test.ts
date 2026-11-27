import { describe, it, expect } from 'vitest';
import { activeModeOf, type ModeDefinition } from '@weasel-js/modes';
import { findConflicts, findScopedConflicts, formatConflict } from './conflicts';
import type { Tool } from '../../types';

const tool = (id: string, bindings: unknown[]): Tool => ({ id, bindings } as unknown as Tool);
const bind = (spec: unknown, actionId = 'x', opts?: unknown) => ({ spec, actionId, ...(opts ? { opts } : {}) });
const action = (id: string, spec: unknown, eligible?: unknown) => ({
  id, label: id, defaultBinding: spec, ...(eligible ? { eligible } : {}),
  invoker: { timing: 'immediate', run: () => {} },
} as never);
const mode = (id: string): ModeDefinition => ({ id, kind: 'soft', allows: [], scoping: false });

describe('findConflicts — duplicated `mod` bindings', () => {
  it('flags one binding declared twice with `mod`, as it does with `ctrl`', () => {
    const spec = { kind: 'key', key: 'z', mods: { mod: true } };
    expect(findConflicts([tool('a', [bind(spec, 'undo'), bind(spec, 'undo')])])).toHaveLength(1);
  });

  it('still folds a `mod` copy against a `ctrl` copy of one binding', () => {
    const c = findConflicts([tool('a', [bind({ kind: 'wheel', mods: { mod: true } }, 'zoom'), bind({ kind: 'wheel', mods: { ctrl: true } }, 'zoom')])]);
    expect(c).toEqual([]);
  });
});
