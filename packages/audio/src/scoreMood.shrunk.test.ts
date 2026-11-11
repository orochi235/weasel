import { describe, expect, it } from 'vitest';
import { readScoreCue } from './scoreMood';

describe('readScoreCue, shrunk from the property tests', () => {
  it('reads a mood within rounding of a cue as all that cue, rather than weighing every cue NaN', () => {
    const r = readScoreCue({ valence: 3.1434555694052576e-162, tension: 0.7, urgency: 1 });
    expect(r.name).toBe('urgency');
    expect(r.weights).toEqual({ dread: 0, investigation: 0, wonder: 0, urgency: 1 });
  });
});
