import { describe, expect, it, vi } from 'vitest';
import type { MenuEntry } from './entries';
import { withLinks } from './links';

describe('withLinks', () => {
  it('navigates with location.assign when no navigator is given', () => {
    window.location.hash = '';
    const out = withLinks([{ kind: 'item', key: 'a', label: 'A', href: '#a', run: () => {} }])[0];
    if (out?.kind !== 'item') throw new Error('shape');
    out.run();
    expect(window.location.hash).toBe('#a');
    window.location.hash = '';
  });
  it('runs the item, then navigates', () => {
    const calls: string[] = [];
    const entries: MenuEntry[] = [
      { kind: 'item', key: 'a', label: 'A', href: '/a', run: () => { calls.push('run'); } },
    ];
    const out = withLinks(entries, (h) => { calls.push(h); })[0];
    if (out?.kind !== 'item') throw new Error('shape');
    out.run();
    expect(calls).toEqual(['run', '/a']);
  });
  it('wraps a link inside a submenu', () => {
    const navigate = vi.fn();
    const entries: MenuEntry[] = [
      { kind: 'submenu', key: 's', label: 'S', entries: [
        { kind: 'item', key: 'b', label: 'B', href: '/b', run: () => {} },
      ] },
    ];
    const out = withLinks(entries, navigate)[0];
    if (out?.kind !== 'submenu' || out.entries[0]?.kind !== 'item') throw new Error('shape');
    out.entries[0].run();
    expect(navigate).toHaveBeenCalledWith('/b');
  });
  it('returns an item without href as the same object', () => {
    const e: MenuEntry = { kind: 'item', key: 'c', label: 'C', run: () => {} };
    expect(withLinks([e], vi.fn())[0]).toBe(e);
  });
});
