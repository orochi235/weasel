import type { Preview } from '@storybook/react';
import '../src/styles.less';
import '../src/theme/light.less';
import '../src/theme/interstellar.less';
import oswaldUrl from '../src/fonts/oswald-latin-variable.woff2?url';

const fontFaceCss = `@font-face {
  font-family: 'Oswald';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('${oswaldUrl}') format('woff2');
}`;
const styleEl = document.createElement('style');
styleEl.textContent = fontFaceCss;
document.head.appendChild(styleEl);

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'lk-bg',
      values: [{ name: 'lk-bg', value: 'var(--lk-bg)' }],
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      defaultValue: 'auto',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'auto', title: 'Auto (OS)' },
          { value: 'light', title: 'Light' },
          { value: 'interstellar', title: 'Interstellar' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme as 'auto' | 'light' | 'interstellar';
      const className =
        theme === 'light'
          ? 'lk-root lk-theme-light'
          : theme === 'interstellar'
            ? 'lk-root lk-theme-interstellar'
            : 'lk-root';
      return (
        <div className={className} style={{ padding: 16, minHeight: '100vh' }}>
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
