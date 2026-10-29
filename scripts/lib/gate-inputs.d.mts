import type { BranchChanges } from './fleet-tree.mjs';

export const CHECK_INPUTS: Record<string, { changed: string[]; reshaped?: string[] }>;
export function skipReason(script: string, changes: BranchChanges | undefined | null): string | undefined;
