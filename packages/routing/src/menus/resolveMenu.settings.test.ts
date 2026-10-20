import { describe, expect, it, vi } from 'vitest';
import type { MenuEntry, MenuNumberEntry, SubmenuEntry } from '@weasel-js/menu';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { resolveSchemaMenu, type MenuSources } from './resolveMenu';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';

const FORM: PrefGroup = {
  name: 'Size',
  children: {
    box: {
      name: 'Box',
      as: 'section',
      children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1, control: 'input' },
        mode: {
          kind: 'enum', name: 'Mode', description: '', default: 'a',
          options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        },
      },
    },
  },
};

function resize(enabled: boolean, mixed: string[] = []): Action {
  return {
    id: 'resize',
    label: 'Resize',
    invoker: { timing: 'immediate', run: () => {} },
    enabled: () => (enabled ? true : ActionDisabledReason.NotApplicable),
    settings: {
      schema: FORM,
      read: () => ({ values: { box: { width: 7, mode: 'b' } }, mixed }),
      params: (path, value) => ({ field: path, value }),
    },
  };
}

function resolve(action: Action, trigger = vi.fn(() => true)): MenuEntry[] {
  const src: MenuSources = { actions: () => [action], depsFor: () => ({}), trigger };
  return resolveSchemaMenu({ name: '', children: { resize: pref.action('resize') } }, src);
}

const rows = (e: MenuEntry | undefined) => (e as SubmenuEntry).entries.filter((r) => r.kind !== 'separator');

describe('resolveSchemaMenu: an action carrying settings', () => {
  it('is a submenu of its form, holding the values it reads', () => {
    const [entry] = resolve(resize(true));
    expect(entry).toMatchObject({ kind: 'submenu', label: 'Resize' });
    const [width, a, b] = rows(entry);
    expect(width).toMatchObject({ kind: 'number', label: 'Width', value: 7 });
    expect(a).toMatchObject({ label: 'A', checked: false });
    expect(b).toMatchObject({ label: 'B', checked: true });
  });

  it('triggers the action with the params a change makes', () => {
    const trigger = vi.fn(() => true);
    const [entry] = resolve(resize(true), trigger);
    (rows(entry)[0] as MenuNumberEntry).set(9);
    expect(trigger).toHaveBeenCalledWith('resize', { field: 'box.width', value: 9 });
  });

  it('shows a mixed field as holding nothing', () => {
    const [entry] = resolve(resize(true, ['box.width']));
    expect(rows(entry)[0]).toMatchObject({ value: undefined });
  });

  it('is a disabled, empty submenu while the action cannot run', () => {
    const [entry] = resolve(resize(false));
    expect(entry).toMatchObject({ kind: 'submenu', disabled: true, entries: [] });
  });
});
