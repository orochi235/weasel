import { type Action, type MenuDef, useActionsRegistry, useMenuHost, useMenus } from '@weasel-js/core';
import { type ConfigEntry, type ConfigSchema, isConfigBranch } from '@weasel-js/labkit/config';
import { type LensActionApi, type LoupePoint, setLensOps } from '@weasel-js/labkit/loupe';
import { type PrefGroup, type PrefLeaf, pref } from '@weasel-js/prefs';
import { useEffect, useMemo } from 'react';
import { type GlobalDeclarations, isForgePath } from '../globals';
import type { ForgeComparison } from './conditions';

/** The actions whose variants are the compare menu's rows, each setting the comparison of the lens it opened on.
 *  DPR rows have one of their own, which a lens showing no Pixels disables. */
export const COMPARE_WITH_ID = 'loupe.compare.with';
export const COMPARE_DPR_ID = 'loupe.compare.dpr';
/** Why a DPR row is disabled: a DPR changes only a Pixels capture. */
export const PIXELS_ONLY = 'Pixels only';
export const COMPARE_MENU_ID = 'loupe.compare';

const DPRS = [1, 2, 3] as const;

/** One row of the compare menu: the submenu it sits in, its label, and the comparison it sets. */
export interface CompareChoice {
  /** The action whose variant the row is. */
  action: typeof COMPARE_WITH_ID | typeof COMPARE_DPR_ID;
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
    return options.map((o): CompareChoice => ({
      action: COMPARE_WITH_ID,
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
    declaration.options.map((o): CompareChoice => ({
      action: COMPARE_WITH_ID,
      key: `global.${key}.${o.value}`,
      group: declaration.label,
      label: o.label,
      compare: { kind: 'custom', globals: { [key]: o.value } } as const,
    })),
  );
  const dprs = DPRS.map((dpr): CompareChoice => ({
    action: COMPARE_DPR_ID,
    key: `dpr.${dpr}`,
    group: 'DPR',
    label: `${dpr}×`,
    compare: { kind: 'custom', dpr } as const,
  }));
  return [...globals, ...dprs, ...(schema ? argChoices(schema.nodes, '') : [])];
}

/** The compare menu: a submenu per global, DPR, and arg, each row naming one variant of `COMPARE_WITH_ID`. */
export function compareMenuDef(choices: readonly CompareChoice[]): MenuDef {
  const groups = new Map<string, Record<string, PrefLeaf>>();
  for (const choice of choices) {
    const rows = groups.get(choice.group) ?? {};
    rows[`c${Object.keys(rows).length}`] = pref.action(`${choice.action}:${choice.key}`);
    groups.set(choice.group, rows);
  }
  const submenus: Record<string, PrefGroup> = {};
  [...groups].forEach(([label, rows], n) => {
    submenus[`g${n}`] = pref.group(label, rows, { as: 'menu' });
  });
  return { id: COMPARE_MENU_ID, menu: pref.group('', submenus) };
}

/** A request to show the menu: where, on which lens, whether it shows Pixels, and the choices for it. `seq` changes
 *  on every open. */
export interface CompareMenuRequest {
  seq: number;
  client: LoupePoint;
  lensId: string;
  /** Whether the lens shows Pixels, the only source a DPR changes. */
  pixels: boolean;
  choices: readonly CompareChoice[];
}

/** The compare menu's two actions, a variant per row, each setting the comparison on the lens `request` opened on. */
export function compareActions(api: LensActionApi<ForgeComparison>, request: CompareMenuRequest): Action[] {
  const one = (id: CompareChoice['action'], label: string, enabled: () => true | string): Action => ({
    id,
    label,
    group: 'loupe',
    enabled,
    variants: request.choices
      .filter((c) => c.action === id)
      .map((c) => ({ key: c.key, label: `${c.group}: ${c.label}`, params: { compare: c.compare, lensId: request.lensId } })),
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        const lensId = (params?.lensId as string | undefined) ?? api.current();
        const compare = params?.compare as ForgeComparison | undefined;
        if (lensId !== null && compare) api.apply(setLensOps(api.scene, lensId, { compare }));
      },
    },
  });
  return [
    one(COMPARE_WITH_ID, 'Compare with', () => true),
    one(COMPARE_DPR_ID, 'Compare at DPR', () => (request.pixels ? true : PIXELS_ONLY)),
  ];
}

/** Props for `CompareMenu`. */
export interface CompareMenuProps {
  api: LensActionApi<ForgeComparison>;
  request: CompareMenuRequest | null;
}

const NO_CHOICES: readonly CompareChoice[] = [];

/** Registers the compare menu's actions and menu for the lens last asked about, and opens it at each request. */
export function CompareMenu({ api, request }: CompareMenuProps) {
  const registry = useActionsRegistry();
  const host = useMenuHost();
  const choices = request?.choices ?? NO_CHOICES;
  const defs = useMemo(() => [compareMenuDef(choices)], [choices]);
  useMenus(defs);
  useEffect(() => {
    if (!registry || !request) return;
    const offs = compareActions(api, request).map((a) => registry.register(a));
    return () => {
      for (const off of offs) off();
    };
  }, [registry, api, request]);
  // After the registrations above, which run first in the same commit.
  useEffect(() => {
    if (request) host?.open({ menu: COMPARE_MENU_ID, client: request.client, source: 'keyboard' });
  }, [host, request]);
  return null;
}
