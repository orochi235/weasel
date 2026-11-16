import { describe, expect, it } from 'vitest';
import { createLatest } from './latest';

describe('createLatest', () => {
  it('holds only the newest ticket', () => {
    const latest = createLatest();
    const first = latest.take();
    expect(first()).toBe(true);
    const second = latest.take();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('retires every ticket on drop, and holds one taken after', () => {
    const latest = createLatest();
    const before = latest.take();
    latest.drop();
    expect(before()).toBe(false);
    expect(latest.take()()).toBe(true);
  });
});
