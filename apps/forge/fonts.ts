import type { GlobalDeclarations, StoryContext } from '@weasel-js/forge';
import { defineTheme, type Theme } from '@weasel-js/theme';

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
  helvetica:  { label: 'Helvetica',      family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weights: [100, 300, 400, 500, 700, 900],      italics: [false, true], stretches: ['ultra-condensed', 'condensed', 'normal'] },
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
    // The toolbar shows a select's value alone, so each option names its slot.
    SLOTS.slice(1).map(({ global, label }) => [
      global,
      {
        label,
        default: THEME,
        options: options([[THEME, 'Theme'], ...FAMILY_OPTIONS].map(([key, name]) => [key, `${label}: ${name}`])),
      },
    ]),
  ),
  fontWeight: { label: 'Weight', default: '500', options: options(WEIGHTS) },
  fontStretch: { label: 'Width', default: 'normal', options: options(STRETCHES) },
  fontStyle: { label: 'Italic', default: 'normal', options: options([['normal', 'Regular'], ['italic', 'Italic']]) },
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

const themes = new Map<string, Theme>();

/** `base` with each slot's chosen family; one theme per combination, named for it. */
export function fontTheme(base: Theme, globals: StoryContext['globals']): Theme {
  const chosen = chosenSlots(globals);
  const name = [base.name, ...chosen.map(({ token, key }) => `${token.slice('font-'.length)}-${key}`)].join('-');
  let theme = themes.get(name);
  if (!theme) {
    const pins = Object.fromEntries(
      chosen.map(({ token, font }) => [
        token,
        { value: font.family.split(',').map((face) => face.trim().replace(/^"|"$/g, '')), type: 'fontFamily' },
      ]),
    );
    theme = defineTheme({ name, extends: base, pins });
    themes.set(name, theme);
  }
  return theme;
}

const nearest = (value: number, supported: number[]): number =>
  supported.reduce((closest, v) => (Math.abs(v - value) < Math.abs(closest - value) ? v : closest), supported[0]!);

/** The rules for the font globals, each snapped to what the chosen font ships. weasel's components read their
 *  family from the font tokens, and form controls do not inherit one, so both are pointed at the choice too. */
export function fontRule(globals: StoryContext['globals']): string {
  const [, font] = fontOf(globals);
  const weight = nearest(Number(globals.fontWeight ?? 500), font.weights);
  const requestedStretch = String(globals.fontStretch ?? 'normal');
  const stretch = font.stretches.includes(requestedStretch) ? requestedStretch : 'normal';
  const italic = globals.fontStyle === 'italic' && font.italics.includes(true);
  const tokens = chosenSlots(globals)
    .map((slot) => `--wzl-${slot.token}: ${slot.font.family};`)
    .join(' ');
  return [
    `:root { font-family: ${font.family}; font-weight: ${weight}; font-stretch: ${stretch}; font-style: ${italic ? 'italic' : 'normal'}; }`,
    // applyTheme declares the tokens at [data-wzl-theme][data-wzl-mode], on the root and on any nested themed box.
    ` :root:root:root, [data-wzl-theme][data-wzl-mode][data-wzl-mode] { ${tokens} }`,
    ' :where(button, input, select, textarea) { font: inherit; }',
  ].join('');
}
