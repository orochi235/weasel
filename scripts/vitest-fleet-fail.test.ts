import { describe, expect, it } from 'vitest';
import { failLine } from './vitest-fleet-fail.mjs';

describe('the fleet-fail line', () => {
  it('names the project, file and test', () => {
    expect(failLine('weasel-ui', 'packages/ui/src/a.test.tsx', 'Bar > drags')).toBe('fleet-fail: weasel-ui packages/ui/src/a.test.tsx :: Bar > drags');
  });

  it('names a gate check by its npm script', () => {
    expect(failLine('gate', 'scripts/ci-checks.gate.ts', 'npm run check:needs')).toBe('fleet-fail: gate check:needs');
  });

  it('names a file that failed with no failing test', () => {
    expect(failLine('browser (chromium)', 'apps/x.browser.test.tsx')).toBe('fleet-fail: browser:chromium apps/x.browser.test.tsx :: (file)');
  });
});
