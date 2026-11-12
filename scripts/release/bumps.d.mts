import type { ReleasePlan } from '@changesets/types';
export const LEVELS: readonly ['patch', 'minor', 'major'];
export function releasedAt(plan: ReleasePlan, level: string): ReleasePlan;
export function isChangesetFile(name: string): boolean;
