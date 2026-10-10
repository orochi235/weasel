import { defineTheme, weaselTheme, type Selection, type Theme } from '@weasel-js/theme';

/** One look the front page can wear: a theme and the mode it is shown in. */
export interface Palette {
  readonly id: string;
  readonly label: string;
  readonly theme: Theme;
  readonly selection: Selection;
}

/** The repo's own colors, from `.hued`: the maroon its terminal tab wears, and the lime beside it. */
const projectTheme = defineTheme({
  name: 'weasel-project',
  pins: {
    surface: '#470013',
    'surface-raised': '#5c0a22',
    'surface-sunken': '#32000d',
    'accent-base': '#89fe05',
    // The bright step is a value of its own in the base theme, not derived from accent-base.
    'accent-strong': '#89fe05',
    'fg-on-accent': '#1a2b00',
  },
});

export const PALETTES: readonly Palette[] = [
  { id: 'charcoal', label: 'Charcoal', theme: weaselTheme, selection: { mode: 'dark' } },
  { id: 'project', label: 'Project', theme: projectTheme, selection: { mode: 'dark' } },
  { id: 'paper', label: 'Paper', theme: weaselTheme, selection: { mode: 'light' } },
];

const STORAGE_KEY = 'weasel-site:front-palette';

/** The palette this browser last chose, or the first when it has chosen none or storage is unavailable. */
export function storedPalette(): Palette {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY);
    return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
  } catch {
    return PALETTES[0];
  }
}

export function storePalette(palette: Palette): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, palette.id);
  } catch {
    // Private windows and blocked site data: the choice lasts for this visit.
  }
}
