import type { Preview } from '@storybook/react-vite';
import '@weasel-js/theme/tokens.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'padded',
    options: {
      storySort: {
        order: ['weasel-ui', ['Foundations', '*']],
        method: 'alphabetical',
      },
    },
  },
};

export default preview;
