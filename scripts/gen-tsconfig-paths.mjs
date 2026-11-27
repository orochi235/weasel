import { join } from 'node:path';
import { cli } from './lib/help.mjs';
import { writeTsconfigPaths } from './lib/tsconfigPaths.mjs';

cli(import.meta.url, {
  summary: "Rewrites the `paths` block of each tsconfig from every package's `exports`.",
});

const changed = writeTsconfigPaths(join(import.meta.dirname, '..'));
console.log(changed.length > 0 ? `paths rewritten: ${changed.join(', ')}` : 'tsconfig paths already current');
