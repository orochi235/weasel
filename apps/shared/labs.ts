import type { LabPage } from '@weasel-js/labkit';

// The dev servers each run on their own port, so a dev link names its host; built, the labs share one site.
const dev = import.meta.env.DEV;

export const FORGE_LAB: LabPage = {
  label: 'weaselforge',
  href: dev ? 'http://localhost:5178' : '/weasel/docs/ui/forge',
};

export const PALETTE_LAB: LabPage = {
  label: 'Palette lab',
  href: dev ? 'http://localhost:5177/weasel/theme-editor' : '/weasel/theme-editor',
};

/** The project's labs, in the order each one's title menu lists them. */
export const LABS: readonly LabPage[] = [FORGE_LAB, PALETTE_LAB];
