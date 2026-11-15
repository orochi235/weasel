/**
 * Stands in for an extension package outside the kit, for `actionParams.typetest.ts`: it reaches weasel only
 * through `@weasel-js/core`'s published entry, and merges its action's params into the schema as one would.
 */
import { defineAction } from '@weasel-js/core';

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'typetest.stamp': { size: number };
  }
}

export const STAMP_ID = 'typetest.stamp';

export const stampAction = defineAction({
  id: STAMP_ID,
  label: 'Stamp',
  invoker: { timing: 'immediate', run: (_deps, params) => { void (params?.size ?? 1); } },
});
