import { afterEach, describe, expect, it } from 'vitest';
import { sweepAcross } from './sweep';

afterEach(() => {
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
  document.body.innerHTML = '';
});

describe('sweepAcross', () => {
  it('presses and moves a primary mouse with its button down, and releases it with none', () => {
    const items = [0, 1].map((i) => {
      const el = document.body.appendChild(document.createElement('div'));
      el.getBoundingClientRect = () => new DOMRect(i * 20, 0, 20, 20);
      return el;
    });
    // jsdom lays nothing out, so the hit test answers from the boxes given above.
    document.elementFromPoint = (x: number) => items[Math.floor(x / 20)] ?? null;
    const seen: [string, number, boolean][] = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      document.body.addEventListener(type, (e) => seen.push([e.type, (e as PointerEvent).buttons, (e as PointerEvent).isPrimary]));
    }
    sweepAcross(items);
    expect(seen).toEqual([
      ['pointerdown', 1, true],
      ['pointermove', 1, true],
      ['pointerup', 0, true],
    ]);
  });
});
