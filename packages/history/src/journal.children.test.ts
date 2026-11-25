import { describe, it, expect } from 'vitest';
import { createHistory } from './history';
import { createChildren } from './journal';
import type { Op } from './op';

interface Box { x: string }

function setX(from: string, to: string): Op {
  return { apply(a: Box) { a.x = to; }, invert: () => setX(to, from) };
}

describe('the journals opened inside a journal', () => {
  it('lets go of each one once it closes', () => {
    const box: Box = { x: '0' };
    const outer = createHistory(box).beginJournal({ label: 'outer' });
    const children = createChildren();
    for (let i = 0; i < 3; i++) {
      const child = outer.beginJournal({ label: `c${i}` });
      children.adopt(child);
      child.applyOps([setX(box.x, `${i}`)], 'set');
      if (i % 2) child.cancel();
      else child.commit();
    }
    const open = outer.beginJournal({ label: 'open' });
    children.adopt(open);
    open.suspend();
    expect(children.openChildren()).toEqual([open]);
  });
});
