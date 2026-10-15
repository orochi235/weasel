import { describe, expect, it, vi } from 'vitest';
import { createMenuHost } from './menuHost';
import type { Action } from '../interactions/actions/action';

const immediate = { timing: 'immediate' as const, run: () => {} };
const actions: Action[] = [{ id: 'cut', label: 'Cut', invoker: immediate }];

function host(activeTool: string | null = null) {
  return createMenuHost({
    actions: () => actions, depsFor: () => undefined, trigger: () => true, activeTool: () => activeTool,
  });
}

describe('createMenuHost', () => {
  it('opens the menu a hit picks, at the client point', () => {
    const h = host();
    h.define({ id: 'sel', when: { bodyTarget: 'selected-body' }, sections: [[{ action: 'cut' }]] });
    expect(h.open({ hit: { bodyTarget: 'selected-body' }, client: { x: 5, y: 6 } })).toBe(true);
    expect(h.current()).toMatchObject({ client: { x: 5, y: 6 }, source: 'pointer' });
    expect(h.current()!.entries).toHaveLength(1);
  });
  it('opens a menu by id', () => {
    const h = host();
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
  });
  it('opens nothing for no match or an empty resolution', () => {
    const h = host();
    h.define({ id: 'gone', when: { bodyTarget: 'empty' }, sections: [[{ action: 'nope' }]] });
    expect(h.open({ hit: { bodyTarget: 'selected-body' }, client: { x: 0, y: 0 } })).toBe(false);
    expect(h.open({ hit: { bodyTarget: 'empty' }, client: { x: 0, y: 0 } })).toBe(false);
    expect(h.current()).toBeNull();
  });
  it('replaces an open menu with a new seq', () => {
    const h = host();
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
    h.open({ menu: 'row', client: { x: 0, y: 0 } });
    const first = h.current()!.seq;
    h.open({ menu: 'row', client: { x: 9, y: 9 } });
    expect(h.current()).toMatchObject({ client: { x: 9, y: 9 } });
    expect(h.current()!.seq).not.toBe(first);
  });
  it('notifies on open and close, and a define can be released', () => {
    const h = host();
    const fn = vi.fn();
    h.subscribe(fn);
    const release = h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
    h.open({ menu: 'row', client: { x: 0, y: 0 } });
    h.close();
    expect(fn).toHaveBeenCalledTimes(2);
    release();
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
  it('uses a tool-owned def while that tool is active', () => {
    const h = host('pen');
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] }, 'pen');
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
  });
  it('a failed open closes the open menu and notifies once', () => {
    const h = host();
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] });
    h.open({ menu: 'row', client: { x: 0, y: 0 } });
    const fn = vi.fn();
    h.subscribe(fn);
    expect(h.open({ menu: 'missing', client: { x: 0, y: 0 } })).toBe(false);
    expect(h.current()).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('close with nothing open does not notify', () => {
    const h = host();
    const fn = vi.fn();
    h.subscribe(fn);
    h.close();
    expect(fn).not.toHaveBeenCalled();
  });
  it('only uses a tool-owned def while that tool is active', () => {
    const h = host('select');
    h.define({ id: 'row', sections: [[{ action: 'cut' }]] }, 'pen');
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
});
