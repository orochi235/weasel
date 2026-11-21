import { describe, expect, it } from 'vitest';
import { ownPadding } from './useInsets';

describe('ownPadding', () => {
  it('takes no inset out of a side whose padding was given in place of the insets', () => {
    const el = document.createElement('span');
    el.style.padding = '4px 20px';
    for (const side of ['top', 'right', 'bottom', 'left']) el.style.setProperty(`--badge-inset-${side}`, '3px');
    el.style.setProperty('--badge-pad-left', '20px');
    document.body.appendChild(el);
    expect(ownPadding(el)).toEqual({ top: 1, right: 17, bottom: 1, left: 20 });
    el.remove();
  });
});
