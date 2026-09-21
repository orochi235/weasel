import { enumerateSelections, fullSelection, pick, selectionKey, type AxisDefs, type Selection, type Varying } from '../axes';
import type { SerializableColorList } from '../colorList';
import type { ThemeDefinition } from '../definition';
import type { RawToken } from '../dtcg/types';
import { derive } from './derive';
import { mergeChain, type Lookup } from './merge';
import { declaredSteps } from './steps';

/**
 * A definition with every rule run: plain or `by`-varying tokens, references intact.
 * A branch `derive` could not produce is left out, so at runtime it falls through to the parent; definitions with
 * issues still bake, because the editor bakes mid-edit and the build refuses them before baking. Cycles and dangling
 * references still throw, as they do in `derive`.
 */
export interface BakedTheme {
  readonly name: string;
  readonly extends: string | null;
  readonly axes: AxisDefs;
  /** In layer order, then definition order. */
  readonly tokens: Readonly<Record<string, Varying<RawToken>>>;
  /** Each ramp this definition declares → its step names in order, which the tokens alone do not keep. */
  readonly ramps?: Readonly<Record<string, readonly string[]>>;
  readonly tones?: SerializableColorList;
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

/** Token names in definition order: ramps, scales, semantics, components, then pins no earlier layer produces. */
function definitionOrder(def: ThemeDefinition): string[] {
  const names = new Set<string>();
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of declaredSteps(entry)) names.add(`${name}-${step}`);
  }
  for (const layer of [def.semantics, def.components, def.pins]) for (const name of Object.keys(layer ?? {})) names.add(name);
  return [...names];
}

/** Derive `definition` at every selection and fold the results into one record of tokens with no rules left. */
export function bake(definition: ThemeDefinition, lookup?: Lookup): BakedTheme {
  return bakeChain(definition, lookup).at(-1)!;
}

/** `definition` and every theme it extends, baked, root first. */
export function bakeChain(definition: ThemeDefinition, lookup?: Lookup): BakedTheme[] {
  const merged = mergeChain(definition, lookup);
  const parentDef = definition.extends ? lookup?.(definition.extends) : undefined;
  const above = parentDef ? bakeChain(parentDef, lookup) : [];
  return [...above, bakeOver(definition, merged, above, lookup)];
}

function bakeOver(definition: ThemeDefinition, merged: ThemeDefinition, above: readonly BakedTheme[], lookup: Lookup | undefined): BakedTheme {
  const axes = merged.axes ?? {};
  const own = table(definition, axes, lookup);

  const at = (sel: Selection, name: string) => own.get(selectionKey(axes, sel))?.[name];
  /** What the runtime shows for `name` from the themes above: the nearest one whose pick succeeds. */
  const inherited = (sel: Selection, name: string): RawToken | undefined => {
    const full = fullSelection(axes, sel);
    for (let i = above.length - 1; i >= 0; i--) {
      const tokens = above[i].tokens;
      if (!Object.hasOwn(tokens, name)) continue;
      const picked = pick(tokens[name], full);
      if (picked.ok) return picked.value;
    }
    return undefined;
  };

  const produced = new Set([...own.values()].flatMap((t) => Object.keys(t)));
  const ordered = definitionOrder(merged).filter((n) => produced.has(n));
  const names = [...ordered, ...[...produced].filter((n) => !ordered.includes(n))];

  const selections = enumerateSelections(axes);
  const tokens: Record<string, Varying<RawToken>> = {};
  for (const name of names) {
    if (selections.every((sel) => same(at(sel, name), inherited(sel, name)))) continue;

    const varying = Object.keys(axes).filter((axis) =>
      selections.some((sel) => Object.keys(axes[axis].values).some((v) => !same(at(sel, name), at({ ...sel, [axis]: v }, name)))),
    );

    const build = (i: number, sel: Record<string, string>): Varying<RawToken> | undefined => {
      if (i === varying.length) return at(fullSelection(axes, sel), name);
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

  const ramps = Object.fromEntries(Object.entries(definition.ramps ?? {}).map(([name, entry]) => [name, declaredSteps(entry)]));
  return {
    name: definition.name,
    extends: definition.extends ?? null,
    axes,
    tokens,
    ...(Object.keys(ramps).length > 0 ? { ramps } : {}),
    ...(definition.tones !== undefined ? { tones: definition.tones } : {}),
  };
}
