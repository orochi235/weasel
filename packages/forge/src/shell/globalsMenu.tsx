import type { LabMenus } from '@weasel-js/labkit';
import { type PrefGroup, pref } from '@weasel-js/prefs';
import { useEffect, useMemo } from 'react';
import type { Globals } from '../protocol/messages';
import { type GlobalDeclarations, labOptions } from './globals';
import { useLabGlobals } from './GlobalsToolbar';

const leafPath = (n: number) => `globals.d${n}.v`;

/**
 * The lab menu bar's Globals menu at `values`: a submenu per declaration holding one enum of the options the
 * header's select offers. `undefined` when nothing is declared.
 */
export function globalsMenu(
  declarations: GlobalDeclarations,
  values: Globals,
  set: (key: string, value: string) => void,
): LabMenus | undefined {
  const entries = Object.entries(declarations);
  if (entries.length === 0) return undefined;
  const submenus: Record<string, PrefGroup> = {};
  const current: Record<string, unknown> = {};
  const keys = new Map<string, string>();
  entries.forEach(([key, declaration], n) => {
    const options = labOptions(declaration, values);
    submenus[`d${n}`] = pref.group(
      declaration.label,
      { v: pref.enum(declaration.label, declaration.default, options) },
      { as: 'menu' },
    );
    current[leafPath(n)] = values[key];
    keys.set(leafPath(n), key);
  });
  return {
    schema: pref.group('', { globals: pref.group('Globals', submenus, { as: 'menu' }) }),
    values: current,
    onChange: (path, value) => {
      const key = keys.get(path);
      if (key !== undefined && typeof value === 'string') set(key, value);
    },
  };
}

/**
 * Reports the lab's Globals menu to `onMenus` as the lab's values change. Renders nothing; mount it inside the
 * lab, since the values live there.
 */
export function GlobalsMenus({
  declarations,
  onMenus,
}: {
  declarations: GlobalDeclarations;
  onMenus: (menus: LabMenus | undefined) => void;
}) {
  const [values, set] = useLabGlobals(declarations);
  const menus = useMemo(() => globalsMenu(declarations, values, set), [declarations, values, set]);
  useEffect(() => onMenus(menus), [menus, onMenus]);
  return null;
}
