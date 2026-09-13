import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.css';
import './frame.css';
import { type Decorator, defineFrameConfig } from '@weasel-js/forge';
import { interstellarTheme } from '@weasel-js/labkit';
import { applyTheme, weaselTheme } from '@weasel-js/theme';
import { ThemeProvider } from '@weasel-js/theme/react';
import type { ReactNode } from 'react';
import { fontRule, GOOGLE_FONTS_HREF } from './fonts';
import { followScheme, useResolvedMode } from './mode';

if (typeof document !== 'undefined' && !document.getElementById('fg-google-fonts')) {
  const link = document.createElement('link');
  link.id = 'fg-google-fonts';
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_HREF;
  document.head.append(link);
}

function LabkitRoot({ picked, children }: { picked: unknown; children: ReactNode }) {
  return (
    <ThemeProvider theme={interstellarTheme} mode={useResolvedMode(picked)} className="lk-root">
      {children}
    </ThemeProvider>
  );
}

const labkitRoot: Decorator = (story, ctx) =>
  ctx.title.startsWith('labkit/') ? <LabkitRoot picked={ctx.globals.mode}>{story()}</LabkitRoot> : story();

const FONT_STYLE_ID = 'fg-font-globals';

const applyGlobals = followScheme((globals, root, mode) => {
  applyTheme(root, weaselTheme, mode);
  const doc = root.ownerDocument;
  let style = doc.getElementById(FONT_STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = FONT_STYLE_ID;
    doc.head.append(style);
  }
  style.textContent = fontRule(globals);
});

export default defineFrameConfig({
  decorators: [labkitRoot],
  applyGlobals,
  cssVarsScope: ':is(:root, [data-wzl-theme], [data-wzl-mode])',
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
});
