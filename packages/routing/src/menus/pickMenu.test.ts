import { describe, expect, it } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { mergeMenuDefs, pickMenu } from './pickMenu';
import { resolveMenu, type MenuSources } from './resolveMenu';
import type { MenuDef } from './types';
import type { Action } from '../interactions/actions/action';

const one = (id: string) => pref.group('', { [id]: pref.action(id) });
const sel: MenuDef = { id: 'sel', when: { bodyTarget: ['selected-body'] }, schema: one('cut') };
const text: MenuDef = { id: 'text', when: { bodyTarget: 'selected-body', bodyKind: 'text' }, schema: one('editText') };
const empty: MenuDef = { id: 'canvas', when: { bodyTarget: 'empty' }, schema: one('paste') };
const chrome: MenuDef = { id: 'row', schema: one('delete') };

describe('pickMenu', () => {
  it('takes the first def whose when matches', () => {
    expect(pickMenu([text, sel, empty], { bodyTarget: 'selected-body', bodyKind: 'text' })?.id).toBe('text');
    expect(pickMenu([text, sel, empty], { bodyTarget: 'selected-body', bodyKind: 'rect' })?.id).toBe('sel');
    expect(pickMenu([text, sel, empty], { bodyTarget: 'empty' })?.id).toBe('canvas');
  });
  it('never picks a def with no when', () => {
    expect(pickMenu([chrome], { bodyTarget: 'empty' })).toBeUndefined();
  });
});

describe('mergeMenuDefs', () => {
  const immediate = { timing: 'immediate' as const, run: () => {} };
  const actions: Action[] = ['cut', 'toolA', 'toolB'].map((id) => ({ id, label: id, invoker: immediate }));
  const src: MenuSources = { actions: () => actions, depsFor: () => undefined, trigger: () => true };
  const labels = (def: MenuDef) => resolveMenu(def, src).map((e) => (e.kind === 'item' ? e.label : e.kind));

  it('joins same-id defs in contribution order, ambient before the active tool, with a separator between', () => {
    const tool: MenuDef = { id: 'sel', schema: pref.group('', { toolA: pref.action('toolA'), toolB: pref.action('toolB') }) };
    const merged = mergeMenuDefs([{ def: tool, owner: 'pen' }, { def: sel, owner: null }], 'pen');
    expect(merged).toHaveLength(1);
    expect(merged[0]!.when).toEqual(sel.when);
    expect(labels(merged[0]!)).toEqual(['cut', 'separator', 'toolA', 'toolB']);
  });
  it('keeps a key two contributions share, under a new one, without touching the originals', () => {
    const again: MenuDef = { id: 'sel', schema: one('cut') };
    const merged = mergeMenuDefs([{ def: sel, owner: null }, { def: again, owner: null }], null);
    expect(labels(merged[0]!)).toEqual(['cut', 'separator', 'cut']);
    expect(new Set(resolveMenu(merged[0]!, src).map((e) => e.key)).size).toBe(3);
    expect(Object.keys(sel.schema.children)).toEqual(['cut']);
  });
  it('drops a tool def while another tool is active', () => {
    const tool: MenuDef = { id: 'sel', schema: one('toolA') };
    expect(labels(mergeMenuDefs([{ def: sel, owner: null }, { def: tool, owner: 'pen' }], 'select')[0]!)).toEqual(['cut']);
  });
});
