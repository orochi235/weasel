import type { Preview } from '@storybook/react';
import '../src/styles.less';
import '../src/theme/light.less';
import '../src/theme/dark.less';

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
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme as 'auto' | 'light' | 'dark';
      const className =
        theme === 'light'
          ? 'lk-root lk-theme-light'
          : theme === 'dark'
            ? 'lk-root lk-theme-dark'
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
