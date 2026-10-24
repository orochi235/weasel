import { enumerateSelections, selectionKey } from '../axes.ts';
import type { ThemeDefinition } from '../definition.ts';
import { hexToRgb } from '../engine/color/oklch.ts';
import { contrastOver, type Rgba } from './computedColor.ts';
import { derive } from '../engine/derive.ts';
import type { Lookup } from '../engine/merge.ts';
import { resolveTheme, themeAxes } from '../resolveTheme.ts';
import type { Theme } from '../theme.ts';
import { GRADE_TOKENS, GRADES } from '../appearance.ts';

/** Text, or a line, that has to read on every ground it is drawn on. Names are tokens, without the prefix. */
export interface Pairing {
  readonly text: string;
  readonly on: readonly string[];
  /** WCAG ratio: 4.5 for text, 3 for a line that has to be seen. */
  readonly min: number;
  /** Emphasis steps drawn in `text` at a lower alpha, which have to clear `min` too. */
  readonly steps?: readonly string[];
}

const ON_SURFACES = ['surface', 'surface-raised', 'surface-sunken', 'surface-popover'];

/**
 * What the built-in theme's text and lines are held to, and all it is held to: its colors are a
 * design decision, not to be changed to clear a ratio in {@link TEXT_PAIRINGS}.
 */
export const BUILT_IN_PAIRINGS: readonly Pairing[] = [
  { text: 'fg', on: ON_SURFACES, min: 4.5, steps: ['fg-muted', 'fg-subtle'] },
  { text: 'fg-on-accent', on: ['accent'], min: 4.5, steps: ['fg-muted-on-accent', 'fg-subtle-on-accent'] },
  { text: 'secondary-fg', on: ['surface'], min: 4.5 },
  { text: 'border-strong', on: ON_SURFACES, min: 3 },
];

/**
 * {@link BUILT_IN_PAIRINGS} and more: the hover fill under on-accent text, and
 * the accent, status and code colors as text on every surface. The built-in
 * theme is not held to the additions; a theme written since is.
 */
export const TEXT_PAIRINGS: readonly Pairing[] = [
  { text: 'fg', on: ON_SURFACES, min: 4.5, steps: ['fg-muted', 'fg-subtle'] },
  { text: 'fg-on-accent', on: ['accent', 'accent-hover'], min: 4.5, steps: ['fg-muted-on-accent', 'fg-subtle-on-accent'] },
  ...['accent-fg', 'secondary-fg', ...GRADES.map((g) => GRADE_TOKENS[g].replace('--wzl-', ''))].map((text) => ({ text, on: ON_SURFACES, min: 4.5 })),
  ...['keyword', 'string', 'number', 'constant', 'property', 'name'].map((k) => ({ text: `code-${k}`, on: ON_SURFACES, min: 4.5 })),
  { text: 'border-strong', on: ON_SURFACES, min: 3 },
];

const HEX = /^#[0-9a-f]{6}$/i;
const STEP = /^rgb\(from currentColor r g b \/ ([\d.]+)\)$/;

/**
 * Everything wrong with `theme` across every mode and density it resolves at:
 * issues from deriving `definition`, a pairing short of its ratio, a paired
 * token that is not a solid color, and two ranks of the type ramp on one size.
 * Empty when the theme clears the gate.
 */
export function gateFailures(theme: Theme, definition: ThemeDefinition, lookup: Lookup, pairings: readonly Pairing[]): string[] {
  const axes = themeAxes(theme);
  const out: string[] = [];
  for (const selection of enumerateSelections(axes)) {
    const at = selectionKey(axes, selection);
    for (const issue of derive(definition, selection, lookup).issues) out.push(`${at}: ${JSON.stringify(issue)}`);

    const tokens = resolveTheme(theme, selection) as Readonly<Record<string, string>>;
    const solid = (name: string): string | undefined => {
      const value = tokens[`--wzl-${name}`];
      if (value !== undefined && HEX.test(value)) return value;
      out.push(`${at}: ${name} is ${value}, not a solid color`);
      return undefined;
    };
    for (const { text, on, min, steps = [] } of pairings) {
      const ink = solid(text);
      if (!ink) continue;
      for (const groundName of on) {
        const ground = solid(groundName);
        if (!ground) continue;
        const check = (label: string, alpha: number) => {
          const ratio = contrastOver([...hexToRgb(ink), alpha] as Rgba, [...hexToRgb(ground), 1] as Rgba);
          if (ratio < min) out.push(`${at}: ${label} on ${groundName} is ${ratio.toFixed(2)}:1, under ${min}:1`);
        };
        check(text, 1);
        for (const step of steps) {
          const alpha = STEP.exec(tokens[`--wzl-${step}`] ?? '')?.[1];
          if (alpha === undefined) out.push(`${at}: ${step} is ${tokens[`--wzl-${step}`]}, not an alpha step of the text color`);
          else check(step, Number(alpha));
        }
      }
    }

    const ranks = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl'].map((r) => tokens[`--wzl-font-size-${r}`]);
    if (new Set(ranks).size !== ranks.length) out.push(`${at}: the type ramp repeats a size: ${ranks.join(' ')}`);
  }
  return out;
}
