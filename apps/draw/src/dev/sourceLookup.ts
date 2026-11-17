import sourceIndex from 'virtual:weasel-source-index';
import { getOwn } from '@weasel-js/registry';
import type { SourceMatch } from './sourceIndex.types';

export type { SourceMatch } from './sourceIndex.types';

/** Where `symbol` is exported, across every package's source and draw's own,
 *  or null. Read from `virtual:weasel-source-index`, which the Vite plugin of
 *  that name builds from the files on disk. */
export function findSourceMatch(symbol: string): SourceMatch | null {
  return getOwn(sourceIndex, symbol) ?? null;
}
