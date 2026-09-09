import type { Preview } from '@storybook/react-vite';
import '@weasel-js/theme/tokens.css';
// The document font moved out of tokens.css, so a surface that wants the kit's
// typography asks for it. Stories are reviewed against the kit's own faces.
import '@weasel-js/theme/fonts.css';

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
