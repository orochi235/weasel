import { describe, expect, it } from 'vitest';
import { runAt } from '../EffectChartDemo';

describe('the effect chart run', () => {
  it('flips the quality check every two seconds', () => {
    expect(runAt(1.9).stages.q?.taken).toBe('yes');
    expect(runAt(2.1).stages.q?.taken).toBe('no');
  });
});
