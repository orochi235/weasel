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
  /** The surface paints `--_s-surface` as its background, so a tone mixes into it. */
  readonly fills?: boolean;
}

/** A surface with a tone and no stance tone takes this; mixing a surface into itself changes nothing. */
export const TONE_BASE = 'var(--wzl-tone, var(--_s-surface))';
export const ACCENT_BASE = 'var(--wzl-tone)';

const begin = (id: string) => `/* BEGIN GENERATED stance rules: ${id} — \`npm run gen:stances\`, do not edit. */`;
const end = (id: string) => `/* END GENERATED stance rules: ${id} */`;

/** `var(--wzl-stance-<name>, <fallback>)`, spelled so the token-read checker sees no literal read. */
const stanceVar = (name: string, fallback: string) => `var(${`--wzl-stance-${name}`}, ${fallback})`;

export function stanceCss(surface: StanceSurface): string {
  const slots = STANCE_SLOTS.filter((slot) => slot.name in surface.base);
  const block = (selector: string, decl: (name: string) => string) =>
    `${selector} {\n${slots.map(({ name }) => `  --_s-${name}: ${decl(name)};`).join('\n')}\n}`;

  const stanced = (stance: string, nested: boolean) => (name: string) => {
    if (name === 'tone') {
      const own = stanceVar(`${stance}-tone`, 'var(--_s-surface)');
      return `var(--wzl-tone, ${nested ? stanceVar(`${stance}-nested-tone`, own) : own})`;
    }
    const outer = stanceVar(`${stance}-${name}`, surface.stanced?.[name] ?? surface.base[name]);
    return nested ? stanceVar(`${stance}-nested-${name}`, outer) : outer;
  };

  const { selector: sel } = surface;
  const rules = [
    // The tone is per surface: set inline on the one that names it, never inherited by one inside it.
    `${sel} {\n  --wzl-tone: initial;\n}`,
    block(sel, (name) => surface.base[name]),
    ...STANCES.flatMap((stance) => [
      block(`${sel}[data-stance='${stance}']`, stanced(stance, false)),
      ...(surface.nests ? [block(`${sel}[data-stance='${stance}'][data-nested]`, stanced(stance, true))] : []),
    ]),
  ];
  if (surface.fills) {
    rules.push(
      `${sel}[data-tone],\n${sel}[data-stance] {\n  background: color-mix(in oklab, var(--_s-tone) var(--_s-tone-mix), var(--_s-surface));\n}`,
    );
  }
  if ('accent' in surface.base) {
    // Only a surface that names its tone recolors its controls. Derived against
    // fg, so the family lightens in a dark mode and darkens in a light one, as
    // the theme's own accent steps do.
    rules.push(
      [
        `${sel}[data-tone] {`,
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
