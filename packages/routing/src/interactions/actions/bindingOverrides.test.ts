import { describe, it, expect, vi } from 'vitest';
import { key } from '@weasel-js/gestures';
import { createDispatcher } from '../dispatcher/dispatcher';
import { makeCtx, makeRegistry } from '../dispatcher/testing/dispatcherStubs';
import type { InputEvent } from '../dispatcher/matcher';
import type { Contribution } from '../../contributions/types';
import { ActionsNode } from './ActionsProvider';
import type { Action } from './action';
import { bindingId, resolveBindingOverrides } from './bindingOverrides';

const press = (k: string): InputEvent => ({
  kind: 'key', key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
});

describe('bindingId', () => {
  it('derives an id from the owner and the position', () => {
    expect(bindingId({ spec: key('A'), actionId: 'act' }, 'loupe', 2)).toBe('loupe#2');
    expect(bindingId({ spec: key('A'), actionId: 'act' }, null, 0)).toBe('act#0');
  });

  it('takes a declared id over the derived one', () => {
    expect(bindingId({ spec: key('A'), actionId: 'act', opts: { id: 'loupe.zoom' } }, 'loupe', 2)).toBe('loupe.zoom');
  });
});

describe('resolveBindingOverrides', () => {
  it('reads route strings and specs, keeps null, and lets a later map win per id', () => {
    const resolved = resolveBindingOverrides([
      { a: '[*:*] keyDown(=) +mod', b: key('B') },
      { b: null },
    ]);
    expect(resolved.get('a')).toEqual(key('Mod+='));
    expect(resolved.get('b')).toBeNull();
  });
});

describe('the dispatcher under overrides', () => {
  const run = vi.fn();
  const zoom: Action = {
    id: 'zoom', label: 'Zoom',
    defaultBinding: [{ spec: key('2'), opts: { id: 'zoom.key' } }],
    invoker: { timing: 'immediate', run },
  };

  it("moves an action's own binding", () => {
    run.mockClear();
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([zoom]),
      bindingOverrides: () => resolveBindingOverrides([{ 'zoom.key': key('=') }]),
    });
    expect(d.handleInput(press('2'), ctx)).toBe('unhandled');
    expect(d.handleInput(press('='), ctx)).toBe('handled');
    expect(run).toHaveBeenCalledOnce();
  });

  it("moves a contribution's binding and removes another", () => {
    run.mockClear();
    const entry: Contribution<never> = {
      id: 'loupe',
      eligibility: { always: true },
      bindings: [
        { spec: key('3'), actionId: 'zoom' },
        { spec: key('4'), actionId: 'zoom' },
      ],
    };
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([{ ...zoom, defaultBinding: undefined }]),
      entriesById: new Map([['loupe', entry]]),
      bindingOverrides: () => resolveBindingOverrides([{ 'loupe#0': key('5'), 'loupe#1': null }]),
    });
    expect(d.handleInput(press('3'), ctx)).toBe('unhandled');
    expect(d.handleInput(press('4'), ctx)).toBe('unhandled');
    expect(d.handleInput(press('5'), ctx)).toBe('handled');
  });

  it('ignores an id no binding has', () => {
    const d = createDispatcher();
    const ctx = makeCtx({
      actions: makeRegistry([zoom]),
      bindingOverrides: () => resolveBindingOverrides([{ nothing: key('9') }]),
    });
    expect(d.handleInput(press('2'), ctx)).toBe('handled');
  });
});

describe('ActionsRegistry.overrideBindings', () => {
  it('merges holders, inner scope over outer and later over earlier, and releases', () => {
    const root = new ActionsNode(null, true, () => null);
    const child = new ActionsNode(root, true, () => null);
    root.registry.overrideBindings({ a: key('1'), b: key('1') });
    const release = child.registry.overrideBindings({ a: key('2') });
    expect(child.registry.bindingOverrides().get('a')).toEqual(key('2'));
    expect(child.registry.bindingOverrides().get('b')).toEqual(key('1'));
    release();
    expect(child.registry.bindingOverrides().get('a')).toEqual(key('1'));
  });
});
