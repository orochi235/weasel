/**
 * `Op` is declared in `@weasel-js/history` — it is a history concept (an
 * invertible, replayable mutation), and keeping the declaration there is what
 * lets that package build without depending on core.
 *
 * Re-exported here so core's own call sites keep importing from
 * `core/ops/types`, which is where they have always looked for it.
 */
export type { Op } from '@weasel-js/history';
