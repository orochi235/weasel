import { useMemo } from 'react';
import type { LabMenus } from '@weasel-js/labkit';
import { ActionDisabledReason, useCommand } from '@weasel-js/core';
import { type PrefGroup, type PrefLeaf, pref } from '@weasel-js/prefs';
import type { Globals } from '../protocol/messages';
import { allLabOptions, type GlobalDeclarations, labOptions } from './globals';
import { useLabGlobals } from './GlobalsToolbar';

const commandId = (key: string, value: string) => `fg.global.${key}.${value}`;

/**
 * The lab menu bar's Globals menu: a submenu per declaration, a row per option. The rows name the commands
 * {@link GlobalsCommands} registers. `undefined` when nothing is declared.
 */
export function globalsMenu(declarations: GlobalDeclarations): PrefGroup | undefined {
  const entries = Object.entries(declarations);
  if (entries.length === 0) return undefined;
  const submenus: Record<string, PrefGroup> = {};
  entries.forEach(([key, declaration], n) => {
    const rows: Record<string, PrefLeaf> = {};
    allLabOptions(declaration).forEach((option, i) => {
      rows[`o${i}`] = pref.action(commandId(key, option.value));
    });
    submenus[`d${n}`] = pref.group(declaration.label, rows, { as: 'menu' });
  });
  return pref.group('', { globals: pref.group('Globals', submenus, { as: 'menu' }) });
}

/** The lab's `menus` for `declarations`: the Globals menu, or `undefined` when none are declared. */
export function useGlobalsMenus(declarations: GlobalDeclarations): LabMenus | undefined {
  return useMemo(() => {
    const schema = globalsMenu(declarations);
    return schema ? { schema } : undefined;
  }, [declarations]);
}

interface GlobalCommandProps {
  name: string;
  value: string;
  label: string;
  shown: boolean;
  values: Globals;
  set: (key: string, value: string) => void;
}

function GlobalCommand({ name, value, label, shown, values, set }: GlobalCommandProps) {
  useCommand(commandId(name, value), label, () => set(name, value), {
    active: () => values[name] === value,
    enabled: () => (shown ? true : ActionDisabledReason.NotApplicable),
  });
  return null;
}

/** Registers a command per option of each global, which the Globals menu's rows run. Mount it inside the lab. */
export function GlobalsCommands({ declarations }: { declarations: GlobalDeclarations }) {
  const [values, set] = useLabGlobals(declarations);
  return (
    <>
      {Object.entries(declarations).flatMap(([name, declaration]) => {
        const shown = new Set(labOptions(declaration, values).map((option) => option.value));
        return allLabOptions(declaration).map((option) => (
          <GlobalCommand
            key={`${name}.${option.value}`}
            name={name}
            value={option.value}
            label={option.label}
            shown={shown.has(option.value)}
            values={values}
            set={set}
          />
        ));
      })}
    </>
  );
}
