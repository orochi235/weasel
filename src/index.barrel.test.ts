import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as Barrel from './index';

const ROOT = __dirname;

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTs(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function findExportedNames(files: string[], pattern: RegExp): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(pattern)) {
      names.add(match[1]);
    }
  }
  return names;
}

describe('kit barrel parity', () => {
  it('re-exports every create*Op factory from src/core/ops/', () => {
    const opFiles = walkTs(join(ROOT, 'core', 'ops'));
    // `export function createFooOp(...)` or `export const createFooOp = ...`
    const factories = findExportedNames(
      opFiles,
      /^export\s+(?:function|const)\s+(create[A-Z][A-Za-z0-9_]*Op)\b/gm,
    );

    expect(factories.size).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const name of factories) {
      if (typeof (Barrel as Record<string, unknown>)[name] !== 'function') {
        missing.push(name);
      }
    }
    expect(missing, `Op factories defined in src/core/ops/ but not re-exported from src/index.ts: ${missing.join(', ')}`).toEqual([]);
  });
});
