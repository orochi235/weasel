import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: 'examples/minimal',
  resolve: {
    alias: {
      '@labkit/react': new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
});
