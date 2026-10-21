import { describe, it, expect } from 'vitest';
import { formatShortcut, held, key } from '@weasel-js/gestures';
import type { Action } from '../interactions/actions/action';
import { resolveBindingOverrides } from '../interactions/actions/bindingOverrides';
import { describeKeymap, keymapShortcuts } from './describeKeymap';
import type { KeymapDef } from './keymapContribution';
import type { OpenKeymap } from './keymapStack';

const actions: Action[] = [
  { id: 'zoom', label: 'Zoom in' },
  { id: 'pin', label: 'Pin' },
  { id: 'peek', label: 'Peek' },
];

const level: OpenKeymap = {
  id: 'loupe', label: 'Loupe', usedWhileHeld: false,
  bindings: [
    { spec: key('2'), actionId: 'zoom' },
    { spec: { kind: 'click', mods: { shift: true } }, actionId: 'pin' },
    { spec: held('Space'), actionId: 'peek' },
  ],
};

describe('describeKeymap', () => {
  it('lists Escape first, then each binding in order with its action label', () => {
    const d = describeKeymap(level, actions);
    expect(d.label).toBe('Loupe');
    expect(d.rows.map((r) => r.label)).toEqual(['Close', 'Zoom in', 'Pin', 'Peek']);
    expect(d.rows[0]!.shortcut).toEqual({ key: 'Escape', mod: false, alt: false, shift: false });
    expect(d.rows[1]!.shortcut?.key).toBe('2');
    expect(d.rows[2]!.gesture).toBe('Shift-click');
    expect(d.rows[3]!.gesture).toBe('Hold Space');
  });

  it('shows a binding where its override moved it, and drops one it unbound', () => {
    const d = describeKeymap(level, actions, resolveBindingOverrides([{ 'loupe#0': key('='), 'loupe#1': null }]));
    expect(d.rows.map((r) => r.label)).toEqual(['Close', 'Zoom in', 'Peek']);
    expect(d.rows[1]!.shortcut?.key).toBe('=');
  });
});

describe('keymapShortcuts', () => {
  const def: KeymapDef = { id: 'loupe', label: 'Loupe', leader: key('Mod+L'), bindings: level.bindings };

  it("gives each key its leader's path", () => {
    const zoom = keymapShortcuts(def).get('zoom')![0]!;
    expect(formatShortcut(zoom, { platform: 'macos' })).toBe('Loupe ▸ 2');
    expect(zoom.leader?.[0]?.shortcut).toEqual({ key: 'L', mod: true, alt: false, shift: false });
  });

  it('follows an override of the leader', () => {
    const o = resolveBindingOverrides([{ 'keymap.loupe.leader': key('M') }]);
    expect(keymapShortcuts(def, o).get('zoom')![0]!.leader?.[0]?.shortcut.key).toBe('M');
  });
});
