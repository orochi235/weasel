import type { GlobalDeclarations, StoryContext } from '@weasel-js/forge';
import { defineTheme, type Theme, weaselTheme } from '@weasel-js/theme';

/** Loads the webfonts the font table names that no system ships. */
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Oswald:wght@200;300;400&family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700;1,900&family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap';

interface FontInfo {
  label: string;
  family: string;
  weights: number[];
  italics: boolean[];
  stretches: string[];
}

// prettier-ignore
const FONTS: Record<string, FontInfo> = {
  oswald:     { label: 'Oswald',         family: 'Oswald, system-ui, sans-serif',                  weights: [200, 300, 400],                     italics: [false],       stretches: ['normal'] },
  helvetica:  { label: 'Helvetica',      family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weights: [100, 300, 400, 500, 700, 900],      italics: [false, true], stretches: ['condensed', 'normal'] },
  futura:     { label: 'Futura',         family: 'Futura, "Trebuchet MS", Arial, sans-serif',      weights: [400, 500, 700],                     italics: [false, true], stretches: ['condensed', 'normal'] },
  inter:      { label: 'Inter',          family: 'Inter, system-ui, sans-serif',                   weights: [300, 400, 500, 600, 700],           italics: [false, true], stretches: ['normal'] },
  roboto:     { label: 'Roboto',         family: 'Roboto, system-ui, sans-serif',                  weights: [300, 400, 500, 700, 900],           italics: [false, true], stretches: ['normal'] },
  openSans:   { label: 'Open Sans',      family: '"Open Sans", system-ui, sans-serif',             weights: [300, 400, 500, 600, 700],           italics: [false, true], stretches: ['normal'] },
  lato:       { label: 'Lato',           family: 'Lato, system-ui, sans-serif',                    weights: [300, 400, 700, 900],                italics: [false, true], stretches: ['normal'] },
  montserrat: { label: 'Montserrat',     family: 'Montserrat, system-ui, sans-serif',              weights: [300, 400, 500, 600, 700, 800],      italics: [false, true], stretches: ['normal'] },
  plexSans:   { label: 'IBM Plex Sans',  family: '"IBM Plex Sans", system-ui, sans-serif',         weights: [300, 400, 500, 600, 700],           italics: [false, true], stretches: ['normal'] },
  plexMono:   { label: 'IBM Plex Mono',  family: '"IBM Plex Mono", ui-monospace, monospace',       weights: [300, 400, 500, 600, 700],           italics: [false, true], stretches: ['normal'] },
  jetbrains:  { label: 'JetBrains Mono', family: '"JetBrains Mono", ui-monospace, monospace',      weights: [300, 400, 500, 600, 700],           italics: [false, true], stretches: ['normal'] },
  ptSans:     { label: 'PT Sans',        family: '"PT Sans", system-ui, sans-serif',               weights: [400, 700],                          italics: [false, true], stretches: ['normal'] },
  system:     { label: 'System',         family: 'system-ui, -apple-system, sans-serif',           weights: [100, 300, 400, 500, 600, 700, 900], italics: [false, true], stretches: ['normal'] },
  serif:      { label: 'Serif',          family: 'ui-serif, Georgia, serif',                       weights: [400, 700],                          italics: [false, true], stretches: ['normal'] },
  mono:       { label: 'Mono',           family: 'ui-monospace, SFMono-Regular, Menlo, monospace', weights: [400, 700],                          italics: [false, true], stretches: ['normal'] },
};

const WEIGHTS: [string, string][] = [
  ['100', 'Thin (100)'],
  ['200', 'Extralight (200)'],
  ['300', 'Light (300)'],
  ['400', 'Regular (400)'],
  ['500', 'Medium (500)'],
  ['600', 'Semibold (600)'],
  ['700', 'Bold (700)'],
  ['800', 'Extrabold (800)'],
  ['900', 'Black (900)'],
];

const STRETCHES: [string, string][] = [
  ['ultra-condensed', 'Ultra Condensed'],
  ['extra-condensed', 'Extra Condensed'],
  ['condensed', 'Condensed'],
  ['semi-condensed', 'Semi Condensed'],
  ['normal', 'Normal'],
  ['semi-expanded', 'Semi Expanded'],
  ['expanded', 'Expanded'],
  ['extra-expanded', 'Extra Expanded'],
  ['ultra-expanded', 'Ultra Expanded'],
];

const options = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

const FAMILY_OPTIONS: [string, string][] = Object.entries(FONTS).map(([key, font]) => [key, font.label]);

/** The theme's own face, left alone: the default of every slot but the default face's. */
const THEME = 'theme';

/** Each weasel font slot and the global that picks its family. */
const SLOTS = [
  { token: 'font-ui', global: 'fontFamily', label: 'Font' },
  { token: 'font-display', global: 'fontDisplay', label: 'Display' },
  { token: 'font-body', global: 'fontBody', label: 'Body' },
  { token: 'font-mono', global: 'fontMono', label: 'Mono' },
] as const;

/** Storybook's font toolbar, as forge globals: a family per weasel font slot, then weight, width and italic. */
export const FONT_GLOBALS: GlobalDeclarations = {
  fontFamily: { label: 'Font', default: 'oswald', options: options(FAMILY_OPTIONS) },
  ...Object.fromEntries(
    SLOTS.slice(1).map(({ global, label }) => [
      global,
      { label, default: THEME, options: options([[THEME, 'Theme'], ...FAMILY_OPTIONS]), under: 'fontFamily' },
    ]),
  ),
  fontWeight: {
    label: 'Weight',
    default: '500',
    options: options(WEIGHTS),
    shows: (value, globals) => fontOf(globals)[1].weights.includes(Number(value)),
  },
  fontStretch: {
    label: 'Width',
    default: 'normal',
    options: options(STRETCHES),
    shows: (value, globals) => fontOf(globals)[1].stretches.includes(value),
  },
  fontStyle: {
    label: 'Italic',
    default: 'normal',
    options: options([['normal', 'Regular'], ['italic', 'Italic']]),
    shows: (value, globals) => fontOf(globals)[1].italics.includes(value === 'italic'),
  },
};

/** Links the webfont stylesheet into `doc` once. */
export function loadWebFonts(doc: Document): void {
  if (doc.getElementById('fg-google-fonts')) return;
  const link = doc.createElement('link');
  link.id = 'fg-google-fonts';
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_HREF;
  doc.head.append(link);
}

/** The default face: the family the Font global names. */
const fontOf = (globals: StoryContext['globals']): [string, FontInfo] => {
  const key = String(globals.fontFamily ?? 'oswald');
  return FONTS[key] ? [key, FONTS[key]] : ['oswald', FONTS.oswald!];
};

/** Each slot whose global names a family, with that family. A slot left on Theme is absent. */
interface ChosenSlot {
  token: string;
  key: string;
  font: FontInfo;
}

function chosenSlots(globals: StoryContext['globals']): ChosenSlot[] {
  return SLOTS.flatMap(({ token, global }): ChosenSlot[] => {
    if (global === 'fontFamily') {
      const [key, font] = fontOf(globals);
      return [{ token, key, font }];
    }
    const key = String(globals[global] ?? THEME);
    const font = FONTS[key];
    return font ? [{ token, key, font }] : [];
  });
}

/** Oswald Tabular carries Oswald's digits alone, so under any other UI face numeric text takes that face's own figures. */
const numericLeavesOswald = (chosen: ChosenSlot[]): boolean =>
  chosen.some(({ token, key }) => token === 'font-ui' && key !== 'oswald');

const themes = new Map<string, Theme>();

/** `base` with each slot's chosen family; one theme per combination, named for it. */
export function fontTheme(base: Theme, globals: StoryContext['globals']): Theme {
  const chosen = chosenSlots(globals);
  const name = [base.name, ...chosen.map(({ token, key }) => `${token.slice('font-'.length)}-${key}`)].join('-');
  let theme = themes.get(name);
  if (!theme) {
    const pins = Object.fromEntries([
      ...chosen.map(({ token, font }) => [
        token,
        { value: font.family.split(',').map((face) => face.trim().replace(/^"|"$/g, '')), type: 'fontFamily' },
      ]),
      ...(numericLeavesOswald(chosen) ? [['font-numeric', '{font-ui}']] : []),
    ]);
    theme = defineTheme({ name, extends: base, pins });
    themes.set(name, theme);
  }
  return theme;
}

const nearest = (value: number, supported: number[]): number =>
  supported.reduce((closest, v) => (Math.abs(v - value) < Math.abs(closest - value) ? v : closest), supported[0]!);

const STRETCH_ORDER = STRETCHES.map(([value]) => value);

/** The width `font` ships nearest `requested`. */
function nearestStretch(requested: string, supported: string[]): string {
  const at = (value: string) => STRETCH_ORDER.indexOf(value);
  const from = at(requested) === -1 ? at('normal') : at(requested);
  return supported.reduce((best, value) => (Math.abs(at(value) - from) < Math.abs(at(best) - from) ? value : best), supported[0]!);
}

const REFERENCE = /^\{([^}.]+)\}$/;

/** Each token of `theme` that aliases a font slot, directly or through another alias, keyed by the slot. */
function slotAliases(theme: Theme): Map<string, string[]> {
  const refs = new Map<string, string | null>();
  for (let t: Theme | null = theme; t; t = t.extends) {
    for (const [name, raw] of Object.entries(t.tokens)) {
      if (refs.has(name)) continue;
      const value = 'value' in raw ? raw.value : undefined;
      refs.set(name, typeof value === 'string' ? (REFERENCE.exec(value.trim())?.[1] ?? null) : null);
    }
  }
  const slots = new Set<string>(SLOTS.map((slot) => slot.token));
  const aliases = new Map<string, string[]>();
  for (const name of refs.keys()) {
    if (slots.has(name)) continue;
    const seen = new Set<string>();
    let at = refs.get(name);
    while (at && !slots.has(at) && !seen.has(at)) {
      seen.add(at);
      at = refs.get(at);
    }
    if (at && slots.has(at)) aliases.set(at, [...(aliases.get(at) ?? []), name]);
  }
  return aliases;
}

const ALIASES = slotAliases(weaselTheme);

/**
 * The rules for the font globals at `scope`, `:root` by default: a story host in the workshop names itself instead.
 * Each is snapped to what the chosen font ships. The theme resolves a token that aliases a slot, such as the panel
 * title's font, to the slot's literal family, so restating the slot alone would leave it behind: each alias is pointed
 * back at its slot.
 */
export function fontRule(globals: StoryContext['globals'], scope = ':root'): string {
  const [, font] = fontOf(globals);
  const weight = nearest(Number(globals.fontWeight ?? 500), font.weights);
  const stretch = nearestStretch(String(globals.fontStretch ?? 'normal'), font.stretches);
  const italic = globals.fontStyle === 'italic' && font.italics.includes(true);
  const chosen = chosenSlots(globals);
  const tokens = [
    ...chosen.flatMap((slot) => [
      `--wzl-${slot.token}: ${slot.font.family};`,
      ...(ALIASES.get(slot.token) ?? []).map((alias) => `--wzl-${alias}: var(--wzl-${slot.token});`),
    ]),
    ...(numericLeavesOswald(chosen) ? ['--wzl-font-numeric: var(--wzl-font-ui);'] : []),
  ].join(' ');
  return [
    `${scope} { font-family: var(--wzl-font-ui); font-weight: ${weight}; font-stretch: ${stretch}; font-style: ${italic ? 'italic' : 'normal'}; }`,
    // applyTheme declares the tokens at [data-wzl-theme][data-wzl-mode] (0,3,0), on the root and on any nested
    // themed box; `:not(#…)` lifts the root's rule above it without `!important`.
    ` ${scope}:not(#fg-font-globals), ${scope} [data-wzl-theme][data-wzl-mode][data-wzl-mode] { ${tokens} }`,
    // At zero specificity, so any component rule that sets its own font wins. A story host names itself by
    // attribute, (0,1,0), which would otherwise beat every one-class component rule, such as a select's trigger.
    // Form controls do not inherit a font, and code elements take the browser's monospace rather than the theme's.
    ` :where(${scope}) :where(button, input, select, textarea) { font: inherit; }`,
    ` :where(${scope}) :where(code, kbd, samp, pre) { font-family: var(--wzl-font-mono); }`,
  ].join('');
}
