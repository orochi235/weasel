import { describe, expect, it } from 'vitest';
import { prepareRoom, type FitRoom } from './fitRoom';

describe('prepareRoom', () => {
  it('publishes the natural width in layout px inside a scaled ancestor', () => {
    const el = document.body.appendChild(document.createElement('div'));
    el.style.boxSizing = 'border-box';
    Object.defineProperties(el, {
      scrollWidth: { value: 100 },
      clientWidth: { value: 100 },
      offsetWidth: { value: 100 },
      getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 50, height: 10 }) },
    });
    const room: FitRoom = { steppedAt: null, spentAt: null, measured: false };
    prepareRoom(el, room, 2, true);
    expect(el.style.getPropertyValue('--fit-natural')).toBe('100px');
    el.remove();
  });
});
