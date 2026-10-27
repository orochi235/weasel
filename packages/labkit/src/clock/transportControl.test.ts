import { describe, expect, it } from 'vitest';
import { transportControl } from './transportControl';
import { createTrialClock } from './trialClock';

const held = { speed: 1, backward: false };

describe('transportControl over a clock with an origin', () => {
  const { clock } = createTrialClock({ duration: 3000, origin: -1000, seekable: true });
  const control = () => transportControl(clock, held, () => {});

  it('reads the playhead as shown time', () => {
    expect(control().start).toBe(-1000);
    expect(control().playhead).toBe(-1000);
    expect(control().length).toBe(3000);
  });

  it('seeks to shown time', () => {
    control().seek(0);
    expect(clock.elapsed).toBe(1000);
    expect(control().playhead).toBe(0);
    control().seek(2000);
    expect(clock.ended).toBe(true);
  });

  it('starts a paused clock at its own speed', () => {
    const slow = createTrialClock({ duration: 3000, speed: 0.5 }).clock;
    expect(transportControl(slow, { speed: slow.speed, backward: false }, () => {}).speed).toBe(
      0.5,
    );
  });
});
