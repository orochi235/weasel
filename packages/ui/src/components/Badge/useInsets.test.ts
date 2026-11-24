import { describe, expect, it } from 'vitest';
import { ownPadding } from './useInsets';

describe('ownPadding', () => {
  it("takes a side's inset out of its padding, even where the padding prop set that side, since the stylesheet adds the two", () => {
    const sheet = document.createElement('style');
    sheet.textContent = '.padded { padding: 4px 20px; }';
    document.head.appendChild(sheet);
    const el = document.createElement('span');
    el.className = 'padded';
    for (const side of ['top', 'right', 'bottom', 'left']) el.style.setProperty(`--badge-inset-${side}`, '3px');
    el.style.setProperty('--badge-pad-left', '17px');
    document.body.appendChild(el);
    expect(ownPadding(el)).toEqual({ top: 1, right: 17, bottom: 1, left: 17 });
    el.remove();
    sheet.remove();
  });

  it('takes no inset out of a side that plain padding in its own style covers, which the stylesheet cannot add to', () => {
    const el = document.createElement('span');
    el.style.setProperty('padding', '4px 20px');
    el.style.setProperty('padding-left', '9px');
    for (const side of ['top', 'right', 'bottom', 'left']) el.style.setProperty(`--badge-inset-${side}`, '3px');
    document.body.appendChild(el);
    expect(ownPadding(el)).toEqual({ top: 4, right: 20, bottom: 4, left: 9 });
    el.remove();
  });
});
