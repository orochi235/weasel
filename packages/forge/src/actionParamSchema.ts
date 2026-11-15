/**
 * The params forge's actions read, merged into routing's `ActionParamSchema`
 * so their variants and triggers are typed.
 */
import type { ForgeComparison } from './shell/loupe/conditions';

/** A compare menu row's params: the comparison it sets, and the lens it sets it on, the current one by default. */
export type ForgeCompareParams = { compare?: ForgeComparison; lensId?: string };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'loupe.compare.with': ForgeCompareParams;
    'loupe.compare.dpr': ForgeCompareParams;
  }
}
