import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stopReason, wantsSplit } from './fleet-parts.mjs';

describe('the fleet run parts', () => {
  it('splits the browser project off only when the plan runs it and nothing pinned the run', () => {
    const plan = 'run: node scripts/vitest-overlap.mjs run --project=core --project=browser --project=gate';
    expect(wantsSplit(plan, ['--branch', 'x'], {})).toBe(true);
    expect(wantsSplit(plan, ['--node', 'studio'], {})).toBe(false);
    expect(wantsSplit(plan, ['--spread', '0'], {})).toBe(false);
    expect(wantsSplit(plan, [], { WEASEL_FLEET_SPLIT: '0' })).toBe(false);
    expect(wantsSplit('run: npx vitest --project=core', [], {})).toBe(false);
  });

  it('reads why it was stopped from the file its parent named, and nothing when there is none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stop-why-'));
    const file = join(dir, 'why');
    expect(stopReason({})).toBeUndefined();
    expect(stopReason({ WEASEL_STOP_WHY: file })).toBeUndefined();
    writeFileSync(file, 'postbuild failed (1)\n');
    expect(stopReason({ WEASEL_STOP_WHY: file })).toBe('postbuild failed (1)');
    rmSync(dir, { recursive: true });
  });
});
