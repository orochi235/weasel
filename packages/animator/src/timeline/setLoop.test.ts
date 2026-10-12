import { describe, expect, it } from 'vitest';
import { makeTimeline } from './createTimeline.test-harness';

describe('setLoop', () => {
  it('turns an endless loop on for a timeline that was not looping', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    handle.setLoop(true);
    advance(250);
    expect(handle.time()).toBeCloseTo(50, 6);
  });

  it('turns an endless loop off, letting the timeline finish', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: true });
    advance(50);
    handle.setLoop(false);
    advance(200);
    expect(handle.time()).toBe(100);
  });

  it('sets a finite lap count', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    handle.setLoop(2);
    advance(350);
    expect(handle.time()).toBe(100);
  });

  it('does not move a timeline parked at duration', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    advance(150);
    expect(handle.time()).toBe(100);
    handle.setLoop(true);
    expect(handle.time()).toBe(100);
    advance(50);
    expect(handle.time()).toBe(100);
  });

  it('loops once a parked timeline is rewound and resumed', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    advance(150);
    handle.setLoop(true);
    handle.seek(0);
    handle.resume();
    advance(250);
    expect(handle.time()).toBeCloseTo(50, 6);
  });
});
