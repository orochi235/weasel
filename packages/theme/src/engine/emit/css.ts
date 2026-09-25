import { enumerateSelections, fullSelection, pick, pickAll, type AxisDefs, type Selection } from '../../axes.ts';
import { resolveTokens } from '../../dtcg/resolve.ts';
import type { RawToken } from '../../dtcg/types.ts';
import type { BakedTheme } from '../bake.ts';
import type { AxisDependency } from '../deps.ts';

export interface EmitInput {
  readonly baked: BakedTheme;
  readonly deps: Readonly<Record<string, AxisDependency>>;
  /** The default theme alone gets `:root` and the unscoped selectors. */
  readonly isDefault: boolean;
}

const REF = /^\{([^}]+)\}$/;

/** `{gray-100}` → `gray-100`. A group prefix (`{color.gray-100}`) is dropped, as `resolveTokens` does. */
function refTarget(token: RawToken): string | null {
  const m = typeof token.value === 'string' ? REF.exec(token.value.trim()) : null;
  if (!m) return null;
  const path = m[1];
  const dot = path.indexOf('.');
  return dot === -1 ? path : path.slice(dot + 1);
}

/** A reference becomes `var()` (or `color-mix()` with an alpha); a literal is resolved. */
export function cssValue(name: string, token: RawToken): string {
  const target = refTarget(token);
  if (target === null) return resolveTokens({ [name]: token })[name];
  if (token.alpha === undefined) return `var(--wzl-${target})`;
  return `color-mix(in srgb, var(--wzl-${target}) ${Math.round(token.alpha * 100)}%, transparent)`;
}

/** Non-empty subsets of the axes, in declaration order, smallest first. */
function axisSets(axes: AxisDefs): string[][] {
  const names = Object.keys(axes);
  const sets: string[][] = [];
  for (let mask = 1; mask < 1 << names.length; mask += 1) sets.push(names.filter((_, i) => mask & (1 << i)));
  return sets.sort((a, b) => a.length - b.length);
}

function combinations(axes: AxisDefs, set: readonly string[]): Selection[] {
  let out: Record<string, string>[] = [{}];
  for (const axis of set) out = out.flatMap((s) => Object.keys(axes[axis].values).map((v) => ({ ...s, [axis]: v })));
  return out;
}

/** The value's scheme, or `normal` when a sibling value has one, so a nested scheme-less value resets it.
 *  A value the theme doesn't declare at all falls back to its tokens from the theme's own default value,
 *  so it takes that value's scheme too, rather than a blanket reset. */
function schemeOf(axes: AxisDefs, axis: string, value: string): string | undefined {
  const def = axes[axis];
  if (!def) return undefined;
  if (!(value in def.values)) return schemeOf(axes, axis, def.default);
  return def.values[value].scheme ?? (Object.values(def.values).some((v) => v.scheme) ? 'normal' : undefined);
}

function checkSchemes({ name, axes }: BakedTheme): void {
  const carrying = Object.keys(axes).filter((a) => Object.values(axes[a].values).some((v) => v.scheme));
  if (carrying.length > 1) throw new Error(`Theme "${name}": only one axis may carry a color scheme, but ${carrying.join(' and ')} do`);
}

/** The theme's axes followed by any the default has and it lacks; a shared axis gets both themes' values. */
function combineAxes(own: AxisDefs, other: AxisDefs): AxisDefs {
  const out: Record<string, AxisDefs[string]> = {};
  for (const [name, def] of Object.entries(own)) out[name] = { ...def, values: { ...other[name]?.values, ...def.values } };
  for (const [name, def] of Object.entries(other)) if (!out[name]) out[name] = def;
  return out;
}

/** A theme as the runtime sees it: each token from the nearest theme in its `extends` chain that has it at a selection. */
class Resolved {
  readonly axes: AxisDefs;
  readonly names: readonly string[];
  private readonly chain: readonly BakedTheme[];
  private readonly memo = new Map<string, Map<string, string>>();

  constructor(axes: AxisDefs, chain: readonly BakedTheme[]) {
    this.axes = axes;
    this.chain = chain;
    this.names = [...new Set([...chain].reverse().flatMap((t) => Object.keys(t.tokens)))];
  }

  token(name: string, sel: Selection): RawToken | undefined {
    const full = fullSelection(this.axes, sel);
    for (const t of this.chain) {
      if (!Object.hasOwn(t.tokens, name)) continue;
      const picked = pick(t.tokens[name], full);
      if (picked.ok) return picked.value;
    }
    return undefined;
  }

  /** What a browser computes: every `var()` substituted, down to literals. */
  expanded(name: string, sel: Selection, stack: readonly string[] = []): string {
    const key = JSON.stringify(fullSelection(this.axes, sel));
    const memo = this.memo.get(key) ?? this.memo.set(key, new Map()).get(key)!;
    const hit = memo.get(name);
    if (hit !== undefined) return hit;
    const token = this.token(name, sel);
    if (!token) return `<unset ${name}>`;
    if (stack.includes(name)) return '<cycle>';
    const value = cssValue(name, token).replace(/var\(--wzl-([^)]+)\)/g, (_, n: string) => this.expanded(n, sel, [...stack, name]));
    memo.set(name, value);
    return value;
  }
}

function chainOf(baked: BakedTheme, byName: ReadonlyMap<string, BakedTheme>): BakedTheme[] {
  if (!baked.extends) return [baked];
  const parent = byName.get(baked.extends);
  if (!parent) throw new Error(`Theme "${baked.name}" extends "${baked.extends}", which is not being emitted`);
  return [baked, ...chainOf(parent, byName)];
}

const union = (axes: AxisDefs, ...sets: (readonly string[] | undefined)[]) => {
  const all = new Set(sets.flatMap((s) => s ?? []));
  return Object.keys(axes).filter((a) => all.has(a));
};

interface Plan {
  readonly theme: string;
  readonly axes: AxisDefs;
  /** Axes that emit `color-scheme` for this theme. */
  readonly schemes: AxisDefs;
  readonly names: readonly string[];
  readonly all: (name: string) => readonly string[];
  readonly own: (name: string) => readonly string[];
  readonly value: (name: string, sel: Selection) => RawToken | undefined;
}

function blocks(lines: string[], plan: Plan, selector: (attrs: string) => string[]): void {
  const { axes, names } = plan;
  for (const set of axisSets(axes)) {
    const members = names.filter((n) => plan.all(n).join(',') === set.join(','));
    const hasOwn = (n: string) => plan.own(n).length > 0;
    const ownFirst = [...members.filter(hasOwn), ...members.filter((n) => !hasOwn(n))];
    const schemeAxis = set.length === 1 ? set[0] : undefined;

    for (const combo of combinations(axes, set)) {
      const scheme = schemeAxis ? schemeOf(plan.schemes, schemeAxis, combo[schemeAxis]) : undefined;
      if (ownFirst.length === 0 && !scheme) continue;
      const attrs = set.map((a) => `[data-wzl-${a}='${combo[a]}']`).join('');
      const decls = ownFirst.flatMap((name) => {
        const token = plan.value(name, combo);
        return token ? [`  --wzl-${name}: ${cssValue(name, token)};`] : [];
      });
      lines.push(...selector(attrs), ...(scheme ? [`  color-scheme: ${scheme};`] : []), ...decls, '}', '');
    }
  }
}

export function emitCss(themes: readonly EmitInput[]): string {
  const defaults = themes.filter((t) => t.isDefault);
  if (defaults.length !== 1) throw new Error(`emitCss needs exactly one default theme, got ${defaults.length}`);
  for (const t of themes) checkSchemes(t.baked);

  const byName = new Map(themes.map((t) => [t.baked.name, t.baked]));
  const def = defaults[0];
  const defResolved = new Resolved(def.baked.axes, [def.baked]);

  // A non-default theme is written as its difference from the default, not from its parent: the default's
  // declarations are the only ones every element can see, and a parent's blocks are scoped to the parent's name.
  const diffed = themes.filter((t) => !t.isDefault).map((t) => {
    const axes = combineAxes(t.baked.axes, def.baked.axes);
    const resolved = new Resolved(t.baked.axes, chainOf(t.baked, byName));
    const selections = enumerateSelections(axes);
    const differs = resolved.names.filter((n) =>
      selections.some((sel) => {
        const mine = resolved.token(n, sel);
        if (!mine) return false;
        const theirs = defResolved.token(n, sel);
        return !theirs || cssValue(n, mine) !== cssValue(n, theirs) || resolved.expanded(n, sel) !== defResolved.expanded(n, sel);
      }),
    );
    return { t, axes, resolved, differs };
  });

  // Every theme declares, under its own name, whatever any non-default theme changes, so a subtree of one
  // theme nested inside another resets instead of inheriting the outer theme's values.
  const redeclared = new Set(diffed.flatMap((d) => d.differs));
  const others = diffed.map(({ t, axes, resolved }): Plan => ({
    theme: t.baked.name,
    axes,
    schemes: t.baked.axes,
    names: resolved.names.filter((n) => redeclared.has(n)),
    all: (n) => union(axes, t.deps[n]?.all, def.deps[n]?.all),
    own: (n) => union(axes, t.deps[n]?.own, def.deps[n]?.own),
    value: (n, sel) => resolved.token(n, sel),
  }));

  const lines = [
    '/* GENERATED by packages/theme/scripts/build-tokens.ts — do not edit.',
    ' * Source: packages/theme/themes/<theme>.json',
    ' */',
    '',
  ];

  const { axes, name: theme } = def.baked;
  const rootValues = pickAll(def.baked.tokens, fullSelection(axes, {}));
  // The default selection's scheme, not just its values: a surface that never calls
  // applyTheme would otherwise get dark colors with light native widgets.
  lines.push(':root {');
  for (const axis of Object.values(axes)) {
    const scheme = axis.values[axis.default]?.scheme;
    if (scheme) lines.push(`  color-scheme: ${scheme};`);
  }
  for (const [name, token] of Object.entries(rootValues)) {
    if (token.description) lines.push(`  /* ${token.description} */`);
    lines.push(`  --wzl-${name}: ${cssValue(name, token)};`);
  }
  lines.push('}', '');

  const reset = Object.keys(rootValues).filter((n) => redeclared.has(n) && (def.deps[n]?.all.length ?? 0) === 0);
  if (reset.length > 0) {
    lines.push(`[data-wzl-theme='${theme}'] {`, ...reset.map((n) => `  --wzl-${n}: ${cssValue(n, rootValues[n])};`), '}', '');
  }

  blocks(
    lines,
    {
      theme,
      axes,
      schemes: axes,
      names: Object.keys(def.baked.tokens),
      all: (n) => def.deps[n]?.all ?? [],
      own: (n) => def.deps[n]?.own ?? [],
      value: (n, sel) => pickAll(def.baked.tokens, fullSelection(axes, sel))[n],
    },
    (attrs) => [`[data-wzl-theme='${theme}']${attrs},`, `${attrs} {`],
  );

  for (const plan of others) {
    const invariant = plan.names.filter((n) => plan.all(n).length === 0);
    if (invariant.length > 0) {
      // `[data-wzl-theme='x']` alone already ties the default's `:root` on specificity and wins on source
      // order, since the default emits first; `:root[...]` guards only against that emission order changing.
      lines.push(`:root[data-wzl-theme='${plan.theme}'],`, `[data-wzl-theme='${plan.theme}'] {`);
      for (const n of invariant) {
        const token = plan.value(n, {});
        if (token) lines.push(`  --wzl-${n}: ${cssValue(n, token)};`);
      }
      lines.push('}', '');
    }
    blocks(lines, plan, (attrs) => [`[data-wzl-theme='${plan.theme}']${attrs} {`]);
  }

  return lines.join('\n');
}
