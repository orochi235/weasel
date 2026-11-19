import { describe, expect, it } from 'vitest';
import { node } from './fakeNode';

describe('fake node', () => {
  it('ignores a repeated connection, as Web Audio does', () => {
    const a = node('a');
    const b = node('b');
    a.connect(b);
    a.connect(b);
    expect(a.connectedTo).toEqual([b]);
    expect(b.connectedFrom).toEqual([a]);
    a.disconnect(b);
    expect(a.connectedTo).toEqual([]);
    expect(b.connectedFrom).toEqual([]);
  });

  it('leaves a node unchanged by a targeted disconnect that throws', () => {
    const a = node('a');
    const b = node('b');
    a.connect(b);
    expect(() => a.disconnect(node('c'))).toThrow(/InvalidAccessError/);
    expect(a.disconnected).toBe(false);
    expect(a.connectedTo).toEqual([b]);
  });
});
