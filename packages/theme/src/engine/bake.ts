import { enumerateSelections, fullSelection, selectionKey, type AxisDefs, type Selection, type Varying } from '../axes';
import type { ThemeDefinition } from '../definition';
import type { RawToken } from '../dtcg/types';
import { derive } from './derive';
import { mergeChain, type Lookup } from './merge';

/** A definition with every rule run: plain or `by`-varying tokens, references intact. */
export interface BakedTheme {
  readonly name: string;
  readonly extends: string | null;
  readonly axes: AxisDefs;
  /** In layer order, then definition order. */
  readonly tokens: Readonly<Record<string, Varying<RawToken>>>;
}

/** Drop undefined fields so tokens compare and serialize the same way. */
function normalize(t: RawToken): RawToken {
  return {
    type: t.type,
    value: t.value,
    ...(t.alpha !== undefined ? { alpha: t.alpha } : {}),
    ...(t.description !== undefined ? { description: t.description } : {}),
  };
}

const same = (a: RawToken | undefined, b: RawToken | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** Selection key → that selection's derived tokens. */
type Table = Map<string, Record<string, RawToken>>;

function table(def: ThemeDefinition, axes: AxisDefs, lookup: Lookup | undefined): Table {
  const out: Table = new Map();
  for (const sel of enumerateSelections(axes)) {
    const { tokens } = derive(def, sel, lookup);
    const normalized: Record<string, RawToken> = {};
    for (const [name, t] of Object.entries(tokens)) normalized[name] = normalize(t);
    out.set(selectionKey(axes, sel), normalized);
  }
  return out;
}

/** Every selection's names in one sequence, each new name placed after the one it follows. */
function mergeOrder(lists: Iterable<readonly string[]>): string[] {
  const out: string[] = [];
  for (const list of lists) {
    let at = -1;
    for (const name of list) {
      const i = out.indexOf(name);
      if (i >= 0) at = i;
      else out.splice(++at, 0, name);
    }
  }
  return out;
}

/** Derive `definition` at every selection and fold the results into one record of tokens with no rules left. */
export function bake(definition: ThemeDefinition, lookup?: Lookup): BakedTheme {
  const axes = mergeChain(definition, lookup).axes ?? {};
  const own = table(definition, axes, lookup);
  const parentDef = definition.extends ? lookup?.(definition.extends) : undefined;
  const parent = parentDef ? table(parentDef, axes, lookup) : undefined;

  const at = (t: Table | undefined, sel: Selection, name: string) => t?.get(selectionKey(axes, sel))?.[name];

  const defaultKey = selectionKey(axes, {});
  const keys = [defaultKey, ...[...own.keys()].filter((k) => k !== defaultKey)];
  const names = mergeOrder(keys.map((k) => Object.keys(own.get(k) ?? {})));

  const selections = enumerateSelections(axes);
  const tokens: Record<string, Varying<RawToken>> = {};
  for (const name of names) {
    if (parent && selections.every((sel) => same(at(own, sel, name), at(parent, sel, name)))) continue;

    const varying = Object.keys(axes).filter((axis) =>
      selections.some((sel) =>
        Object.keys(axes[axis].values).some((v) => !same(at(own, sel, name), at(own, { ...sel, [axis]: v }, name))),
      ),
    );

    const build = (i: number, sel: Record<string, string>): Varying<RawToken> | undefined => {
      if (i === varying.length) return at(own, fullSelection(axes, sel), name);
      const axis = varying[i];
      const branch: Record<string, unknown> = { by: axis };
      let any = false;
      for (const v of Object.keys(axes[axis].values)) {
        const x = build(i + 1, { ...sel, [axis]: v });
        if (x !== undefined) {
          branch[v] = x;
          any = true;
        }
      }
      return any ? (branch as Varying<RawToken>) : undefined;
    };
    const value = build(0, {});
    if (value !== undefined) tokens[name] = value;
  }

  return { name: definition.name, extends: definition.extends ?? null, axes, tokens };
}
