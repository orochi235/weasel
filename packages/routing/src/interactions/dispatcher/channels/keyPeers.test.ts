import { describe, expect, it, vi } from 'vitest';
import { joinSurface, passOn } from './keyPeers';

const key = () => new KeyboardEvent('keydown', { key: 'a' });

describe('joinSurface', () => {
  it('lets a release called twice leave a channel that joined since in place', () => {
    const surface = document.createElement('div');
    const first = vi.fn();
    const leave = joinSurface(surface, first);
    leave();
    const later = vi.fn();
    joinSurface(surface, later);
    leave();
    passOn(surface, () => {}, key());
    expect(first).not.toHaveBeenCalled();
    expect(later).toHaveBeenCalledOnce();
  });

  it('lets a channel joined twice leave once per release', () => {
    const surface = document.createElement('div');
    const take = vi.fn();
    const leaveA = joinSurface(surface, take);
    joinSurface(surface, take);
    leaveA();
    leaveA();
    passOn(surface, () => {}, key());
    expect(take).toHaveBeenCalledOnce();
  });
});
