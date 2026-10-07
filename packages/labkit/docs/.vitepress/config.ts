import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'labkit',
  description: 'React widgets for building self-contained interactive lab pages',
  // Served as a sub-site of weasel's GitHub Pages (orochi235.github.io/weasel/).
  base: '/weasel/labkit/',
  cleanUrls: true,
  srcExclude: ['superpowers/**', 'IDEAS.md'],
  markdown: {
    // Vue compiles inline code as template, so the README's `seed={{ … }}`
    // examples would be evaluated; fenced blocks are already v-pre.
    config: (md) => {
      const inline = md.renderer.rules.code_inline;
      if (!inline) return;
      md.renderer.rules.code_inline = (...args) => inline(...args).replace('<code', '<code v-pre');
    },
  },
  themeConfig: {
    nav: [
      { text: 'Recipes', link: '/RECIPES' },
      { text: 'Agent Guide', link: '/AGENTS' },
      {
        text: 'Workshop',
        link: 'https://orochi235.github.io/weasel/docs/ui/forge/',
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
    socialLinks: [{ icon: 'github', link: 'https://github.com/orochi235/weasel' }],
  },
});
