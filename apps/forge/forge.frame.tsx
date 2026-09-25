import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.css';
import './frame.css';
import { type Decorator, defineFrameConfig } from '@weasel-js/forge';
import type { LabMode } from '@weasel-js/labkit';
import { applyTheme, weaselTheme } from '@weasel-js/theme';
import { fontRule, loadWebFonts } from './fonts';
import { followScheme } from './mode';

if (typeof document !== 'undefined') loadWebFonts(document);

const asLabMode = (picked: unknown): LabMode =>
  picked === 'light' || picked === 'dark' ? picked : 'auto';

const DENSITIES = ['compact', 'comfortable', 'roomy'];
const asDensity = (picked: unknown): string =>
  typeof picked === 'string' && DENSITIES.includes(picked) ? picked : 'comfortable';

const isLabkit = (title: string): boolean => title.startsWith('labkit/');

// Imported only for labkit's own stories: the package is most of what a frame would otherwise load.
let LabRoot: typeof import('@weasel-js/labkit').LabRoot | null = null;

const labkitRoot: Decorator = (story, ctx) =>
  LabRoot && isLabkit(ctx.title) ? <LabRoot mode={asLabMode(ctx.globals.mode)}>{story()}</LabRoot> : story();

const applyGlobals = followScheme((globals, { root, scope, style }, mode) => {
  applyTheme(root, weaselTheme, { mode, density: asDensity(globals.density) });
  style(fontRule(globals, scope));
});

export default defineFrameConfig({
  decorators: [labkitRoot],
  prepare: async (story) => {
    if (isLabkit(story.title)) LabRoot ??= (await import('@weasel-js/labkit')).LabRoot;
  },
  applyGlobals,
  cssVarsScope: ':is(:root, [data-wzl-theme], [data-wzl-mode], [data-wzl-density])',
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
});
