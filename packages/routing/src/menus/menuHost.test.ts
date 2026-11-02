import { describe, expect, it, vi } from 'vitest';
import { pref } from '@weasel-js/prefs';
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
    h.define({ id: 'sel', when: { bodyTarget: 'selected-body' }, menu: pref.group('', { cut: pref.action('cut') }) });
    expect(h.open({ hit: { bodyTarget: 'selected-body' }, client: { x: 5, y: 6 } })).toBe(true);
    expect(h.current()).toMatchObject({ client: { x: 5, y: 6 }, source: 'pointer' });
    expect(h.current()!.entries).toHaveLength(1);
  });
  it('keeps the rect a menu was opened under', () => {
    const h = host();
    h.define({ id: 'm', menu: pref.group('', { cut: pref.action('cut') }) });
    h.open({ menu: 'm', client: { x: 1, y: 2 }, under: { x: 1, y: 2, w: 30, h: 10 } });
    expect(h.current()?.under).toEqual({ x: 1, y: 2, w: 30, h: 10 });
  });
  it('opens a menu by id', () => {
    const h = host();
    h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
  });
  it('opens nothing for no match or an empty resolution', () => {
    const h = host();
    h.define({ id: 'gone', when: { bodyTarget: 'empty' }, menu: pref.group('', { nope: pref.action('nope') }) });
    expect(h.open({ hit: { bodyTarget: 'selected-body' }, client: { x: 0, y: 0 } })).toBe(false);
    expect(h.open({ hit: { bodyTarget: 'empty' }, client: { x: 0, y: 0 } })).toBe(false);
    expect(h.current()).toBeNull();
  });
  it('replaces an open menu with a new seq', () => {
    const h = host();
    h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
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
    const release = h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
    h.open({ menu: 'row', client: { x: 0, y: 0 } });
    h.close();
    expect(fn).toHaveBeenCalledTimes(2);
    release();
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
  it('a listener that throws stops neither the others nor the open', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = host();
    h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
    h.subscribe(() => { throw new Error('boom'); });
    const after = vi.fn();
    h.subscribe(after);
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
  it('a listener unsubscribed by an earlier one in the same notify is not called', () => {
    const h = host();
    h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
    const later = vi.fn();
    let offLater = () => {};
    h.subscribe(() => offLater());
    offLater = h.subscribe(later);
    h.open({ menu: 'row', client: { x: 0, y: 0 } });
    expect(later).not.toHaveBeenCalled();
  });
  it('uses a tool-owned def while that tool is active', () => {
    const h = host('pen');
    h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) }, 'pen');
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(true);
  });
  it('a failed open closes the open menu and notifies once', () => {
    const h = host();
    h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) });
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
    h.define({ id: 'row', menu: pref.group('', { cut: pref.action('cut') }) }, 'pen');
    expect(h.open({ menu: 'row', client: { x: 0, y: 0 } })).toBe(false);
  });
  it('has() answers what open() would, without opening or notifying', () => {
    const h = host();
    const fn = vi.fn();
    h.subscribe(fn);
    h.define({ id: 'sel', when: { bodyTarget: 'selected-body' }, menu: pref.group('', { cut: pref.action('cut') }) });
    h.define({ id: 'gone', when: { bodyTarget: 'empty' }, menu: pref.group('', { nope: pref.action('nope') }) });
    expect(h.has({ hit: { bodyTarget: 'selected-body' }, client: { x: 0, y: 0 } })).toBe(true);
    expect(h.has({ hit: { bodyTarget: 'empty' }, client: { x: 0, y: 0 } })).toBe(false);
    expect(h.has({ menu: 'sel', client: { x: 0, y: 0 } })).toBe(true);
    expect(h.current()).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
