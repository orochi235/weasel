import { isByAxis, type Selection, type ThemeDefinition, type Varying } from '@weasel-js/theme';
import { contrast, type SemanticRule } from '@weasel-js/theme/engine';
import type { ModeView } from './draft';
import { ruleSummary, stepOf } from './model';

export type RuleKind = 'step' | 'offset' | 'contrast' | 'ref' | 'literal';

export const RULE_KINDS: readonly { readonly value: RuleKind; readonly label: string }[] = [
  { value: 'step', label: 'Step' },
  { value: 'offset', label: 'Offset' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'ref', label: 'Reference' },
  { value: 'literal', label: 'Literal' },
];

export function ruleKind(rule: SemanticRule): RuleKind {
  if ('ref' in rule) return 'ref';
  if ('contrast' in rule) return 'contrast';
  if ('offset' in rule) return 'offset';
  if ('step' in rule) return 'step';
  return 'literal';
}

/** A new rule of `kind`, carrying over the type, description and check of the one it replaces. */
export function defaultRule(
  kind: RuleKind,
  current: SemanticRule,
  ramps: Readonly<Record<string, readonly string[]>>,
  semantics: readonly string[],
): SemanticRule {
  const common = {
    ...(current.type !== undefined ? { type: current.type } : {}),
    ...(current.description !== undefined ? { description: current.description } : {}),
    ...(current.check !== undefined ? { check: current.check } : {}),
  };
  const [ramp, steps] = Object.entries(ramps)[0] ?? ['gray', []];
  const surface = semantics[0] ?? 'surface';
  switch (kind) {
    case 'step':
      return { ...common, ramp, step: steps[0] ?? '' };
    case 'offset':
      return { ...common, from: surface, offset: 1, dir: 'away' };
    case 'contrast':
      return { ...common, ramp, contrast: { min: 4.5, against: [surface] } };
    case 'ref':
      return { ...common, ref: `${ramp}-${steps[0] ?? ''}` };
    case 'literal':
      return { ...common, value: '' };
  }
}

export function pickRule(rule: Varying<SemanticRule>, selection: Selection): SemanticRule | undefined {
  let r: unknown = rule;
  while (isByAxis(r)) {
    const value = selection[r.by];
    if (value === undefined || !Object.hasOwn(r, value)) return undefined;
    r = (r as Record<string, unknown>)[value];
  }
  return r as SemanticRule;
}

export interface ContrastCheck {
  readonly against: string;
  readonly min: number;
  /** null when either side is not a solid hex color. */
  readonly ratio: number | null;
}

export interface SemanticCell {
  readonly mode: string | undefined;
  readonly hex: string;
  readonly step: string | undefined;
  /** What the rule alone produced. */
  readonly produced: string;
  readonly pin: string | undefined;
  readonly checks: readonly ContrastCheck[];
}

export interface SemanticRowView {
  readonly name: string;
  readonly summary: string;
  readonly pinned: boolean;
  /** A pin this definition holds, which it can revert; an inherited pin it cannot. */
  readonly ownPin: boolean;
  readonly cells: readonly SemanticCell[];
  /** The lowest measured ratio, and whether every check cleared its minimum. */
  readonly worst: { readonly ratio: number; readonly pass: boolean } | null;
}

const HEX = /^#[0-9a-f]{6}$/i;
const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export function semanticRows(draft: ThemeDefinition, merged: ThemeDefinition, views: readonly ModeView[]): SemanticRowView[] {
  return Object.entries(merged.semantics ?? {}).map(([name, rule]) => {
    const cells = views
      .filter((v) => Object.hasOwn(v.result.tokens, name))
      .map((v): SemanticCell => {
        const final = v.resolved as Readonly<Record<string, string>>;
        const token = v.result.tokens[name];
        const p = v.result.provenance[name];
        const hex = final[`--wzl-${name}`] ?? text(token.value);
        const picked = pickRule(rule, v.selection);
        const wanted = [
          ...(picked && 'contrast' in picked ? picked.contrast.against.map((against) => ({ against, min: picked.contrast.min })) : []),
          ...(picked?.check ? picked.check.against.map((against) => ({ against, min: picked.check!.contrast })) : []),
        ];
        const checks = wanted.map((w) => {
          const other = final[`--wzl-${w.against}`];
          return { ...w, ratio: HEX.test(hex) && other !== undefined && HEX.test(other) ? contrast(hex, other) : null };
        });
        return {
          mode: v.mode,
          hex,
          step: stepOf(name, v.result),
          produced: text(p.pinned ? p.generated?.value : token.value),
          pin: p.pinned ? text(token.value) : undefined,
          checks,
        };
      });
    const measured = cells.flatMap((c) => c.checks).filter((c): c is ContrastCheck & { ratio: number } => c.ratio !== null);
    const worst =
      measured.length === 0 ? null : { ratio: Math.min(...measured.map((c) => c.ratio)), pass: measured.every((c) => c.ratio >= c.min) };
    return {
      name,
      summary: ruleSummary(rule),
      pinned: cells.some((c) => c.pin !== undefined),
      ownPin: Object.hasOwn(draft.pins ?? {}, name),
      cells,
      worst,
    };
  });
}
