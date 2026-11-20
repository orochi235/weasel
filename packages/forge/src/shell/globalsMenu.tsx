import { type LabMenus, useLabContext } from '@weasel-js/labkit';
import { type PrefGroup, pref } from '@weasel-js/prefs-schema';
import { useEffect, useMemo } from 'react';
import { getOwn } from '@weasel-js/registry';
import type { StoryGlobals } from '../protocol/messages';
import { followApp, type GlobalDeclarations, type LabChrome, labOptions } from './globals';
import { useLabGlobals } from './GlobalsToolbar';

const leafPath = (n: number): `globals.d${number}.v` => `globals.d${n}.v`;

/**
 * The lab menu bar's StoryGlobals menu at `values`: a submenu per declaration holding one enum of the options the
 * header's select offers. `undefined` when nothing is declared. Each `shows` is asked with `App` resolved against
 * `chrome`, when given.
 */
export function globalsMenu(
  declarations: GlobalDeclarations,
  values: StoryGlobals,
  set: (key: string, value: string) => void,
  chrome?: LabChrome,
): LabMenus | undefined {
  const entries = Object.entries(declarations);
  if (entries.length === 0) return undefined;
  const asked = chrome ? followApp(declarations, values, chrome) : values;
  const submenus: Record<string, PrefGroup> = {};
  const current: Record<string, unknown> = {};
  const keys = new Map<string, string>();
  entries.forEach(([key, declaration], n) => {
    const options = labOptions(declaration, asked);
    submenus[`d${n}`] = pref.group(
      declaration.label,
      { v: pref.enum(declaration.label, declaration.default, options) },
      { as: 'menu' },
    );
    current[leafPath(n)] = getOwn(values, key);
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
 * Reports the lab's StoryGlobals menu to `onMenus` as the lab's values change. Renders nothing; mount it inside the
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
  const { mode } = useLabContext();
  const menus = useMemo(() => globalsMenu(declarations, values, set, { mode }), [declarations, values, set, mode]);
  useEffect(() => onMenus(menus), [menus, onMenus]);
  return null;
}
