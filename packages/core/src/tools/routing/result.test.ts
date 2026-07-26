import { describe, it, expect } from 'vitest';
import {
  apply, begin, hold, commit, cancel, claim, none,
  type Result, type BeginSpec,
} from './result';

describe('action constructors', () => {
  it('apply tags ops and label', () => {
    const r = apply([], 'Insert');
    expect(r).toEqual({ kind: 'apply', ops: [], label: 'Insert' });
  });

  it('apply without label', () => {
    const r = apply([]);
    expect(r).toEqual({ kind: 'apply', ops: [] });
  });

  it('begin tags BeginSpec', () => {
    const spec: BeginSpec<{ x: number }> = { scratch: { x: 1 } };
    const r = begin(spec);
    expect(r).toEqual({ kind: 'begin', spec: { scratch: { x: 1 } } });
  });

  it('hold tags new scratch', () => {
    const r = hold({ x: 2 });
    expect(r).toEqual({ kind: 'hold', scratch: { x: 2 } });
  });

  it('commit tags ops and label', () => {
    const r = commit([], 'Done');
    expect(r).toEqual({ kind: 'commit', ops: [], label: 'Done' });
  });

  it('cancel takes no args', () => {
    const r = cancel();
    expect(r).toEqual({ kind: 'cancel' });
  });

  it('claim takes no args', () => {
    const r = claim();
    expect(r).toEqual({ kind: 'claim' });
  });

  it('none takes no args', () => {
    const r = none();
    expect(r).toEqual({ kind: 'none' });
  });

  it('Result union discriminates correctly', () => {
    const r: Result<{ x: number }> = apply([]);
    switch (r.kind) {
      case 'apply':  break;
      case 'begin':  break;
      case 'hold':   break;
      case 'commit': break;
      case 'cancel': break;
      case 'claim':  break;
      case 'none':   break;
    }
    expect(r.kind).toBe('apply');
  });
});
