import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.css';
import { type Decorator, defineFrameConfig, type StoryContext } from '@weasel-js/forge';
import { ThemeProvider } from '@weasel-js/theme/react';
import type { ReactNode } from 'react';
import { icons as drawIcons } from '@draw/icons.table';
import { icons as pathToolsIcons } from '@weasel-js/path-tools/icons';
import { icons as rigIcons } from '@weasel-js/rig/icons';
import { devtoolsDock } from './devtools';
import { fontRule, loadWebFonts } from './fonts';
import { followScheme, useResolvedMode } from './mode';
import { applyTrialTheme, trialChoice } from './themes';

if (typeof document !== 'undefined') loadWebFonts(document);

const isLabkit = (title: string): boolean => title.startsWith('labkit/');

// Imported only for labkit's own stories: the package is most of what a frame would otherwise load.
let LabRoot: typeof import('@weasel-js/labkit').LabRoot | null = null;

// A LabRoot with no theme above it applies labkit's own, over the trial's.
function LabkitTrial({ globals, children }: { globals: StoryContext['globals']; children: ReactNode }) {
  const Root = LabRoot!;
  const { theme, density } = trialChoice(globals);
  const mode = useResolvedMode(globals.mode);
  return (
    <ThemeProvider theme={theme} selection={{ mode, density }}>
      <Root>{children}</Root>
    </ThemeProvider>
  );
}

const labkitRoot: Decorator = (story, ctx) =>
  LabRoot && isLabkit(ctx.title) ? <LabkitTrial globals={ctx.globals}>{story()}</LabkitTrial> : story();

const applyGlobals = followScheme((globals, { root, scope, style }, mode) => {
  applyTrialTheme(root, globals, mode);
  style(fontRule(globals, scope));
});
import.meta.hot?.dispose(applyGlobals.dispose);

export default defineFrameConfig({
  decorators: [labkitRoot, devtoolsDock],
  icons: [pathToolsIcons, rigIcons, drawIcons],
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
