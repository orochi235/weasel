import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const example = process.env.LABKIT_EXAMPLE ?? 'minimal';

export default defineConfig({
  plugins: [react()],
  root: `examples/${example}`,
  resolve: {
    alias: {
      '@labkit/react': new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
});
