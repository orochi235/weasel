import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

/** Runs `body` with a `name` command first on the PATH that never answers. POSIX only. */
export async function withStalledCommand<T>(name: string, body: () => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'forge-stalled-'));
  writeFileSync(join(dir, name), '#!/bin/sh\nexec sleep 30\n', { mode: 0o755 });
  const path = process.env.PATH;
  process.env.PATH = `${dir}${delimiter}${path ?? ''}`;
  try {
    return await body();
  } finally {
    process.env.PATH = path;
    rmSync(dir, { recursive: true, force: true });
  }
}
