import { join } from 'node:path';
import { writeTsconfigPaths } from './lib/tsconfigPaths.mjs';

const changed = writeTsconfigPaths(join(import.meta.dirname, '..'));
console.log(changed.length > 0 ? `paths rewritten: ${changed.join(', ')}` : 'tsconfig paths already current');
