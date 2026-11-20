import { describe, expect, it, vi } from 'vitest';
import { createHostedAnimator } from './createHostedAnimator';

describe('tween onCancel', () => {
  const host = () => {
    let now = 0;
    const hosted = createHostedAnimator({ now: () => now, requestFrame: () => {} });
    return { animator: hosted.animator, step: (t: number) => { now = t; hosted.tick(t); } };
  };

  it('hears a cancel by handle, by key, by cancelAll and by a tween taking its key, and never a finish', () => {
    const { animator, step } = host();
    const heard: string[] = [];
    const start = (name: string, key?: string) => animator.tween({
      from: 0, to: 1, ms: 100, cancelKey: key, onTick: () => {},
      onDone: () => heard.push(`${name} done`), onCancel: () => heard.push(`${name} canceled`),
    });
    const a = start('a');
    start('b', 'k');
    start('c', 'm');
    start('d');
    start('e');
    step(0);
    a.cancel();
    animator.cancelKey('k');
    start('c2', 'm');
    animator.cancelAll();
    start('f');
    step(200);
    step(400);
    expect(heard).toEqual(['a canceled', 'b canceled', 'c canceled', 'd canceled', 'e canceled', 'c2 canceled', 'f done']);
  });

  it('hears a tween retired for a tick that threw', () => {
    const { animator, step } = host();
    const onCancel = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    animator.tween({ from: 0, to: 1, ms: 100, onTick: (v) => { if (v > 0) throw new Error('boom'); }, onCancel });
    step(0);
    step(50);
    expect(onCancel).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
