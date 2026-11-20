export const MODULE_CACHE_ROOT: string;
export function externalHash(lock: { packages?: Record<string, { link?: boolean; version?: string; integrity?: string; resolved?: string }> }): string;
export function moduleCacheDir(root: string): string;
