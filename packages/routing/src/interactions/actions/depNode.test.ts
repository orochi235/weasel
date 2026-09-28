import { describe, it, expect } from 'vitest';
import { createDepRegistry } from '../../index';

// The stock registry, from the React-free entry, for a dispatcher driven
// without a provider tree.
describe('createDepRegistry', () => {
  it('answers a registered source, reading it at get time', () => {
    const deps = createDepRegistry();
    let n = 1;
    deps.register('selection' as never, (() => n) as never);
    n = 2;
    expect(deps.get('selection' as never)).toBe(2);
  });

  it('restores the displaced source when the newer one leaves', () => {
    const deps = createDepRegistry();
    deps.register('selection' as never, (() => 'old') as never);
    const release = deps.register('selection' as never, (() => 'new') as never);
    expect(deps.get('selection' as never)).toBe('new');
    release();
    expect(deps.get('selection' as never)).toBe('old');
  });

  it('answers undefined for a name nothing registered', () => {
    expect(createDepRegistry().get('selection' as never)).toBeUndefined();
  });

  it('keeps each registry to itself', () => {
    const a = createDepRegistry();
    const b = createDepRegistry();
    a.register('selection' as never, (() => 1) as never);
    expect(b.get('selection' as never)).toBeUndefined();
  });
});
