import { describe, it, expect } from 'vitest';
import { createNodeRouting, type NodeRoutingEntry } from './NodeRouting';

const rect: NodeRoutingEntry = {
  name: 'rect',
  matches: (d) => (d as { kind?: string } | null)?.kind === 'rect',
};
const ellipse: NodeRoutingEntry = {
  name: 'ellipse',
  matches: (d) => (d as { kind?: string } | null)?.kind === 'ellipse',
};

describe('createNodeRouting', () => {
  it("returns 'unknown' when no kind claims the node", () => {
    const r = createNodeRouting();
    expect(r.classify({ kind: 'anything' })).toBe('unknown');
    expect(r.classify(null)).toBe('unknown');
    expect(r.classify(undefined)).toBe('unknown');
  });

  it('classifies a node by the first matching kind', () => {
    const r = createNodeRouting();
    r.register(rect);
    r.register(ellipse);
    expect(r.classify({ kind: 'rect' })).toBe('rect');
    expect(r.classify({ kind: 'ellipse' })).toBe('ellipse');
    expect(r.classify({ kind: 'star' })).toBe('unknown');
  });

  it('walks registered kinds in registration order (first match wins)', () => {
    const r = createNodeRouting();
    const anyKind: NodeRoutingEntry = { name: 'any', matches: () => true };
    r.register(anyKind);
    r.register(rect);
    expect(r.classify({ kind: 'rect' })).toBe('any');
  });

  it('throws on duplicate-name registration', () => {
    const r = createNodeRouting();
    r.register(rect);
    expect(() => r.register({ ...rect, matches: () => false })).toThrow(
      /duplicate.*rect/i,
    );
  });

  it('get() returns the registered entry or undefined', () => {
    const r = createNodeRouting();
    r.register(rect);
    expect(r.get('rect')).toBe(rect);
    expect(r.get('missing')).toBeUndefined();
  });

  it('list() returns entries in registration order', () => {
    const r = createNodeRouting();
    r.register(ellipse);
    r.register(rect);
    expect(r.list().map((k) => k.name)).toEqual(['ellipse', 'rect']);
  });
});
