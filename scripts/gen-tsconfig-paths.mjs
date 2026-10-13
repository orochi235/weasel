import { join } from 'node:path';
import { writeTsconfigPaths } from './lib/tsconfigPaths.mjs';

const changed = writeTsconfigPaths(join(import.meta.dirname, '..'));
console.log(changed ? 'tsconfig.json: paths rewritten' : 'tsconfig.json: paths already current');
