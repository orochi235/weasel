import { describe, expect, it } from 'vitest';
import * as core from '@weasel-js/core';
import * as ui from './dlog';

describe('the debug flag', () => {
  it('is the one core exports, so both packages read one cache', () => {
    expect(ui.isDebugEnabled).toBe(core.isDebugEnabled);
    expect(ui.dlog).toBe(core.dlog);
  });
});

describe('the module doc', () => {
  it('names in its example only namespaces ui logs under', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(__dirname);
    const doc = readFileSync(join(dir, 'dlog.ts'), 'utf8');
    const named = [...doc.matchAll(/setItem\('weasel\.debug', '([^'*]+)'\)/g)].flatMap((m) => m[1]!.split(','));
    const source = (readdirSync(dir, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    expect(named.length).toBeGreaterThan(0);
    for (const ns of named) expect(source, ns).toContain(`dlog('${ns}'`);
  });
});
