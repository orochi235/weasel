import { STANCE_SLOTS, STANCES } from '@weasel-js/theme';

/** Build-time only: `npm run gen:stances` writes each surface's rules into its stylesheet. */

/** A surface that takes a stance, as its stylesheet's generated region describes it. */
export interface StanceSurface {
  /** Names the region, and the markers around it. */
  readonly id: string;
  /** The stylesheet holding the region, relative to the repo root. */
  readonly file: string;
  /** The surface's root element. */
  readonly selector: string;
  /**
   * The surface's own look for each slot it draws — what it reads with no
   * stance, and what a stance falls back to for a slot the theme leaves unset.
   * A slot left out is one the surface does not draw.
   */
  readonly base: Readonly<Record<string, string>>;
  /** A stanced surface's fallback, where it differs from `base`. */
  readonly stanced?: Readonly<Record<string, string>>;
  /** The surface nests inside its own kind and marks it `data-nested`. */
  readonly nests?: boolean;
  /** The surface paints `--_s-fill` — its surface, with any tint mixed in — as its background. */
  readonly fills?: boolean;
  /**
   * A tinted surface sinks its controls' wells one step below its fill, not to
   * the theme's sunken surface. Not for a surface whose own surface is the
   * sunken one: the two would define each other.
   */
  readonly sinks?: boolean;
  /** The surface takes a tint and no stance. */
  readonly stanceless?: boolean;
}

/** A surface with a tint and no stance tint takes this; mixing a surface into itself changes nothing. */
export const TINT_BASE = 'var(--wzl-tint, var(--_s-surface))';
export const ACCENT_BASE = 'var(--wzl-tint)';

const begin = (id: string) => `/* BEGIN GENERATED stance rules: ${id} — \`npm run gen:stances\`, do not edit. */`;
const end = (id: string) => `/* END GENERATED stance rules: ${id} */`;

/** `var(--wzl-stance-<name>, <fallback>)`, spelled so the token-read checker sees no literal read. */
const stanceVar = (name: string, fallback: string) => `var(${`--wzl-stance-${name}`}, ${fallback})`;

const slotDecls = (surface: StanceSurface, pairs: [string, string][]) =>
  pairs.filter(([name]) => name in surface.base).map(([name, value]) => `  --_s-${name}: ${value};`);

const EMPHASIS: Record<string, [string, string][]> = {
  high: [
    ['border-color', 'var(--wzl-accent-fg)'],
    ['title-color', 'var(--wzl-accent-fg)'],
  ],
  low: [['title-color', 'var(--wzl-fg-muted)']],
};

function emphasisRules(surface: StanceSurface): string[] {
  return Object.entries(EMPHASIS).flatMap(([level, pairs]) => {
    const body = slotDecls(surface, pairs);
    if (!body.length) return [];
    const sel = `${surface.selector}[data-emphasis='${level}']`;
    return [`${surface.nests ? `${sel},\n${sel}[data-nested]` : sel} {\n${body.join('\n')}\n}`];
  });
}

function gradeRules(surface: StanceSurface): string[] {
  const body = slotDecls(surface, [
    ['tint', 'var(--wzl-tint, var(--wzl-grade))'],
    ['border-color', 'var(--wzl-grade)'],
    ['title-color', 'var(--wzl-grade)'],
    ['accent', 'var(--wzl-tint, var(--wzl-grade))'],
  ]);
  if (!body.length) return [];
  const sel = `${surface.selector}[data-grade]`;
  // A nested stanced surface's block is (0,3,0); its graded twin must match that to win on order.
  const selector = surface.nests ? `${sel},\n${sel}[data-nested]` : sel;
  return [`${selector} {\n${body.join('\n')}\n}`];
}

export function stanceCss(surface: StanceSurface): string {
  const slots = STANCE_SLOTS.filter((slot) => slot.name in surface.base);
  const block = (selector: string, decl: (name: string) => string) =>
    `${selector} {\n${slots.map(({ name }) => `  --_s-${name}: ${decl(name)};`).join('\n')}\n}`;

  const stanced = (stance: string, nested: boolean) => (name: string) => {
    if (name === 'tint') {
      const own = stanceVar(`${stance}-tint`, 'var(--_s-surface)');
      return `var(--wzl-tint, ${nested ? stanceVar(`${stance}-nested-tint`, own) : own})`;
    }
    if (name === 'accent') {
      const own = `var(--wzl-stance-${stance}-accent)`;
      return `var(--wzl-tint, ${nested ? stanceVar(`${stance}-nested-accent`, own) : own})`;
    }
    const outer = stanceVar(`${stance}-${name}`, surface.stanced?.[name] ?? surface.base[name]);
    return nested ? stanceVar(`${stance}-nested-${name}`, outer) : outer;
  };

  const { selector: sel } = surface;
  const rules = [
    // The tint is per surface: set inline on the one that names it, never inherited by one inside it.
    `${sel} {\n  --wzl-tint: initial;\n}`,
    block(sel, (name) => surface.base[name]),
    ...(surface.stanceless ? [] : STANCES).flatMap((stance) => [
      block(`${sel}[data-stance='${stance}']`, stanced(stance, false)),
      ...(surface.nests ? [block(`${sel}[data-stance='${stance}'][data-nested]`, stanced(stance, true))] : []),
    ]),
    ...emphasisRules(surface),
    ...gradeRules(surface),
  ];
  if (surface.fills) {
    rules.push(
      `${sel} {\n  --_s-fill: var(--_s-surface);\n}`,
      `${sel}[data-tint],\n${sel}[data-grade],\n${sel}[data-stance] {\n  --_s-fill: color-mix(in oklab, var(--_s-tint) var(--_s-tint-mix), var(--_s-surface));\n}`,
    );
  }
  if (surface.sinks) {
    // A fixed lightness step, so a well reads one step down in either mode.
    rules.push(`${sel}[data-tint],\n${sel}[data-grade] {\n  --wzl-surface-sunken: oklch(from var(--_s-fill) calc(l - 0.06) c h);\n}`);
  }
  if ('accent' in surface.base) {
    // Only a surface that names its tint recolors its controls. Derived against
    // fg, so the family lightens in a dark mode and darkens in a light one, as
    // the theme's own accent steps do.
    rules.push(
      [
        `${sel}[data-tint] {`,
        '  --wzl-accent: var(--_s-accent);',
        '  --wzl-accent-base: var(--_s-accent);',
        '  --wzl-accent-strong: color-mix(in oklab, var(--_s-accent) 70%, var(--wzl-fg));',
        '  --wzl-accent-soft: color-mix(in oklab, var(--_s-accent) 45%, var(--wzl-surface));',
        '  --wzl-accent-hover: var(--wzl-accent-strong);',
        '  --wzl-accent-fg: var(--wzl-accent-strong);',
        '  --wzl-focus-ring: var(--wzl-accent-strong);',
        '}',
      ].join('\n'),
    );
  }
  return [begin(surface.id), ...rules, end(surface.id)].join('\n\n');
}

/** `css` with `surface`'s generated region replaced by a fresh one. */
export function withStanceCss(css: string, surface: StanceSurface): string {
  const start = css.indexOf(begin(surface.id));
  const stop = css.indexOf(end(surface.id));
  if (start === -1 || stop === -1) throw new Error(`${surface.file} has no generated stance region for "${surface.id}"`);
  return css.slice(0, start) + stanceCss(surface) + css.slice(stop + end(surface.id).length);
}
