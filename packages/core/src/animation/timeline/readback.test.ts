import { describe, expect, it } from 'vitest';
import { makeTimeline } from './createTimeline.test-harness';

describe('TimelineHandle.loop', () => {
  it('reads back the option the timeline was created with', () => {
    expect(makeTimeline({ duration: 100, loop: true }).handle.loop()).toBe(true);
    expect(makeTimeline({ duration: 100, loop: 3 }).handle.loop()).toBe(3);
    expect(makeTimeline({ duration: 100 }).handle.loop()).toBe(false);
  });

  it('reads back what setLoop wrote', () => {
    const { handle } = makeTimeline({ duration: 100, loop: false });
    handle.setLoop(true);
    expect(handle.loop()).toBe(true);
    handle.setLoop(2);
    expect(handle.loop()).toBe(2);
    handle.setLoop(false);
    expect(handle.loop()).toBe(false);
  });

  it('counts down as a finite loop consumes its laps', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: 2 });
    advance(150);
    expect(handle.loop()).toBe(1);
    advance(250);
    expect(handle.loop()).toBe(false);
  });

  it('stays true across laps of an endless loop', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: true });
    advance(450);
    expect(handle.loop()).toBe(true);
  });
});

describe('TimelineHandle.timeScale', () => {
  it('starts at 1', () => {
    expect(makeTimeline({ duration: 100 }).handle.timeScale()).toBe(1);
  });

  it('reads back what setTimeScale wrote', () => {
    const { handle } = makeTimeline({ duration: 100 });
    handle.setTimeScale(0.25);
    expect(handle.timeScale()).toBe(0.25);
  });

  // The entry a parked timeline was registered under is gone, so a scale read
  // off the animator would report the revived entry's default of 1.
  it('survives the timeline parking at its duration', () => {
    const { handle, advance } = makeTimeline({ duration: 100 });
    handle.setTimeScale(2);
    advance(150);
    expect(handle.timeScale()).toBe(2);
    handle.seek(0);
    expect(handle.timeScale()).toBe(2);
  });
});
