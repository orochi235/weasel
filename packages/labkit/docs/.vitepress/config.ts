import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'labkit',
  description:
    'React widgets for building self-contained interactive lab pages',
  base: '/labkit/',
  cleanUrls: true,
  srcExclude: ['superpowers/**', 'IDEAS.md'],
  themeConfig: {
    nav: [
      { text: 'Recipes', link: '/RECIPES' },
      { text: 'Agent Guide', link: '/AGENTS' },
      {
        text: 'Storybook',
        link: 'https://orochi235.github.io/labkit/storybook/',
      },
    ],
    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Recipes', link: '/RECIPES' },
          { text: 'Agent Guide', link: '/AGENTS' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/orochi235/labkit' },
    ],
  },
});
