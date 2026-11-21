import { describe, expect, it } from 'vitest';
import { wantsSplit } from './fleet-parts.mjs';

describe('the fleet run parts', () => {
  it('splits the browser project off only when the plan runs it and nothing pinned the run', () => {
    const plan = 'run: node scripts/vitest-overlap.mjs run --project=core --project=browser --project=gate';
    expect(wantsSplit(plan, ['--branch', 'x'], {})).toBe(true);
    expect(wantsSplit(plan, ['--node', 'studio'], {})).toBe(false);
    expect(wantsSplit(plan, ['--spread', '0'], {})).toBe(false);
    expect(wantsSplit(plan, [], { WEASEL_FLEET_SPLIT: '0' })).toBe(false);
    expect(wantsSplit('run: npx vitest --project=core', [], {})).toBe(false);
  });
});
