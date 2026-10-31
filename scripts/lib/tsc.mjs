// The compiler the typecheck scripts run: TypeScript 7's native one. The `typescript` package stays
// on 6.0 for the tools that need its JavaScript API (typescript-eslint, typedoc, tsup's .d.ts build),
// which 7.0 does not ship. One thread, so a local check holds a single core.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const TSC = join(dirname(createRequire(import.meta.url).resolve('typescript-7/package.json')), 'bin/tsc');

/** Spawn arguments for `tsc ...args`, run by this Node. */
export const tscArgv = (args) => [TSC, ...args, '--singleThreaded'];
