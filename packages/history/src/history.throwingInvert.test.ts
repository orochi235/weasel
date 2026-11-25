import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import type { Op } from './op';

interface Box { log: string[] }

function op(name: string, invertThrows = false): Op {
  return {
    apply(a: Box) { a.log.push(name); },
    invert: () => {
      if (invertThrows) throw new Error(`no inverse for ${name}`);
      return { apply(a: Box) { a.log.push(`-${name}`); }, invert: () => op(name) };
    },
  };
}

const boom: Op = { apply() { throw new Error('apply failed'); }, invert: () => boom };

describe('rolling back a failed step', () => {
  it('rethrows the failing apply and takes back the rest when an inverse cannot be built', () => {
    const box: Box = { log: [] };
    const warnings: string[] = [];
    const h = createHistory(box, { debug: { log: () => {}, warn: (m) => warnings.push(m) } });

    expect(() => h.applyOps([op('a'), op('b', true), boom], 'x')).toThrow('apply failed');
    expect(box.log).toEqual(['a', 'b', '-a']);
    expect(warnings.join('\n')).toMatch(/no inverse for b/);
  });
});
