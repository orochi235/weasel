import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'demo',
  base: '/weasel/',
  resolve: {
    alias: {
      '@orochi235/weasel': resolve(__dirname, 'src/index.ts'),
    },
  },
  plugins: [react()],
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
});
