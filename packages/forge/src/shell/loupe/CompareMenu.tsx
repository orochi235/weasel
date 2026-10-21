import { type Action, type MenuDef, useActionsRegistry, useMenuHost, useMenus } from '@weasel-js/core';
import { type ConfigEntry, type ConfigSchema, isConfigBranch } from '@weasel-js/labkit/config';
import { type LensActionApi, type LoupePoint, setLensOps } from '@weasel-js/labkit/loupe';
import { type PrefGroup, type PrefLeaf, pref } from '@weasel-js/prefs';
import { useEffect, useMemo } from 'react';
import { type GlobalDeclarations, isForgePath } from '../globals';
import type { ForgeComparison } from './conditions';

/** The action whose variants are the compare menu's rows, each setting the current lens's comparison. */
export const COMPARE_WITH_ID = 'loupe.compare.with';
export const COMPARE_MENU_ID = 'loupe.compare';

const DPRS = [1, 2, 3] as const;

/** One row of the compare menu: the submenu it sits in, its label, and the comparison it sets. */
export interface CompareChoice {
  key: string;
  group: string;
  label: string;
  compare: ForgeComparison;
}

/** Each leaf of `shape` a comparison can set, by its dotted path: a boolean, or one with options. */
function argChoices(shape: Readonly<Record<string, ConfigEntry>>, at: string): CompareChoice[] {
  return Object.entries(shape).flatMap(([key, entry]) => {
    const path = at === '' ? key : `${at}.${key}`;
    if (isForgePath(path)) return [];
    if (isConfigBranch(entry)) return argChoices(entry.children, path);
    const options: readonly { value: unknown; label: string }[] =
      entry.kind === 'boolean'
        ? [
            { value: true, label: 'On' },
            { value: false, label: 'Off' },
          ]
        : (entry.annotations.options ?? []);
    return options.map((o) => ({
      key: `arg.${path}.${String(o.value)}`,
      group: `Arg ${path}`,
      label: o.label,
      compare: { kind: 'custom', args: { [path]: o.value } } as const,
    }));
  });
}

/** What a lens can be compared against: every declared global's options, DPR 1×, 2× and 3×, and the args of the
 *  story under it that are booleans or have options. */
export function compareChoices(declarations: GlobalDeclarations, schema: ConfigSchema<unknown> | null): CompareChoice[] {
  const globals = Object.entries(declarations).flatMap(([key, declaration]) =>
    declaration.options.map((o) => ({
      key: `global.${key}.${o.value}`,
      group: declaration.label,
      label: o.label,
      compare: { kind: 'custom', globals: { [key]: o.value } } as const,
    })),
  );
  const dprs = DPRS.map((dpr) => ({ key: `dpr.${dpr}`, group: 'DPR', label: `${dpr}×`, compare: { kind: 'custom', dpr } as const }));
  return [...globals, ...dprs, ...(schema ? argChoices(schema.nodes, '') : [])];
}

/** The compare menu: a submenu per global, DPR, and arg, each row naming one variant of `COMPARE_WITH_ID`. */
export function compareMenuDef(choices: readonly CompareChoice[]): MenuDef {
  const groups = new Map<string, Record<string, PrefLeaf>>();
  for (const choice of choices) {
    const rows = groups.get(choice.group) ?? {};
    rows[`c${Object.keys(rows).length}`] = pref.action(`${COMPARE_WITH_ID}:${choice.key}`);
    groups.set(choice.group, rows);
  }
  const submenus: Record<string, PrefGroup> = {};
  [...groups].forEach(([label, rows], n) => {
    submenus[`g${n}`] = pref.group(label, rows, { as: 'menu' });
  });
  return { id: COMPARE_MENU_ID, menu: pref.group('', submenus) };
}

/** `COMPARE_WITH_ID`, with a variant per choice. */
export function compareWithAction(api: LensActionApi<ForgeComparison>, choices: readonly CompareChoice[]): Action {
  return {
    id: COMPARE_WITH_ID,
    label: 'Compare with',
    group: 'loupe',
    variants: choices.map((c) => ({ key: c.key, label: `${c.group}: ${c.label}`, params: { compare: c.compare } })),
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        const lensId = api.current();
        const compare = params?.compare as ForgeComparison | undefined;
        if (lensId !== null && compare) api.apply(setLensOps(api.scene, lensId, { compare }));
      },
    },
  };
}

/** A request to show the menu: where, and the choices for the lens it opened on. `seq` changes on every open. */
export interface CompareMenuRequest {
  seq: number;
  client: LoupePoint;
  choices: readonly CompareChoice[];
}

/** Props for `CompareMenu`. */
export interface CompareMenuProps {
  api: LensActionApi<ForgeComparison>;
  request: CompareMenuRequest | null;
}

const NO_CHOICES: readonly CompareChoice[] = [];

/** Registers the compare menu's action and menu for the choices last asked for, and opens it at each request. */
export function CompareMenu({ api, request }: CompareMenuProps) {
  const registry = useActionsRegistry();
  const host = useMenuHost();
  const choices = request?.choices ?? NO_CHOICES;
  const defs = useMemo(() => [compareMenuDef(choices)], [choices]);
  useMenus(defs);
  useEffect(() => registry?.register(compareWithAction(api, choices)), [registry, api, choices]);
  // After the registrations above, which run first in the same commit.
  useEffect(() => {
    if (request) host?.open({ menu: COMPARE_MENU_ID, client: request.client, source: 'keyboard' });
  }, [host, request]);
  return null;
}
