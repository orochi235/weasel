import '@weasel-js/theme/tokens.css';
import '@weasel-js/labkit/styles.css';
import './frame.css';
import { type Decorator, defineConfig } from '@weasel-js/forge';
import { interstellarTheme } from '@weasel-js/labkit';
import { ThemeProvider } from '@weasel-js/theme/react';

const labkitRoot: Decorator = (story, ctx) => {
  if (!ctx.title.startsWith('labkit/')) return story();
  const mode = typeof ctx.globals.mode === 'string' ? ctx.globals.mode : 'dark';
  return (
    <ThemeProvider theme={interstellarTheme} mode={mode} className="lk-root">
      {story()}
    </ThemeProvider>
  );
};

export default defineConfig({
  frame: { decorators: [labkitRoot], cssVarsScope: ':is(:root, [data-wzl-theme], [data-wzl-mode])' },
});
