export function contentHashes(): (path: string) => string | null;
export function readCached(file: string, hashOf: (path: string) => string | null): unknown;
export function writeCached(file: string, inputs: string[], result: unknown, hashOf: (path: string) => string | null): void;
