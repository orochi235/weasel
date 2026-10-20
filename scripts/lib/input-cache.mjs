import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** A file's content hash by path, or null for a missing file, each file read once per call to this. */
export const contentHashes = () => {
  const seen = new Map();
  return (path) => {
    if (!seen.has(path)) {
      seen.set(path, existsSync(path) ? createHash('sha1').update(readFileSync(path)).digest('hex') : null);
    }
    return seen.get(path);
  };
};

/** The result stored at `file`, if every input it was stored with still hashes the same. */
export const readCached = (file, hashOf) => {
  let stored;
  try {
    stored = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
  const fresh = Object.entries(stored.inputs ?? {}).every(([path, hash]) => hashOf(path) === hash);
  return fresh ? stored.result : undefined;
};

export const writeCached = (file, inputs, result, hashOf) => {
  writeFileSync(file, JSON.stringify({ inputs: Object.fromEntries(inputs.map((path) => [path, hashOf(path)])), result }));
};
