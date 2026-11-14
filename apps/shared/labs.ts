import type { LabPage } from '@weasel-js/labkit';
import ports from '../../scripts/dev-ports.json' with { type: 'json' };

// The dev servers each run on their own port, so a dev link names its host; built, the labs share one site.
const dev = import.meta.env.DEV;

export const FORGE_LAB: LabPage = {
  label: 'weaselforge',
  href: dev ? `http://localhost:${ports.forge}` : '/weasel/docs/ui/forge',
};

export const PALETTE_LAB: LabPage = {
  label: 'Palette lab',
  href: dev ? `http://localhost:${ports.themeEditor}/weasel/theme-editor` : '/weasel/theme-editor',
};

export const THEME_EDITOR_LAB: LabPage = {
  label: 'Theme editor',
  href: `${PALETTE_LAB.href}#/theme`,
};

export const THEME_PREFS_LAB: LabPage = {
  label: 'Theme prefs',
  href: `${PALETTE_LAB.href}#/prefs`,
};

export const BADGE_LAB: LabPage = {
  label: 'Badge lab',
  href: dev ? `http://localhost:${ports.uiLab}/weasel/ui-lab/` : '/weasel/ui-lab/',
};

export const BADGE_SHAPES_LAB: LabPage = {
  label: 'Badge shapes',
  href: `${BADGE_LAB.href}#/badge-shapes`,
};

export const BADGE_OCTANTS_LAB: LabPage = {
  label: 'Quatrefoil octants',
  href: `${BADGE_LAB.href}#/badge-octants`,
};

/** The project's labs, in the order each one's title menu lists them. */
export const LABS: readonly LabPage[] = [
  FORGE_LAB, PALETTE_LAB, THEME_EDITOR_LAB, THEME_PREFS_LAB, BADGE_LAB, BADGE_SHAPES_LAB, BADGE_OCTANTS_LAB,
];
