import { describe, expect, it } from 'vitest';
import { createTarget } from '../target';
import { clocked } from '../pbt.fixture';

describe('holds, shrunk from the property tests', () => {
  it('a hold weighing nothing, released with a commit under a full cover, leaves the committed value alone', () => {
    const h = clocked();
    let committed = { x: 0, y: 5 };
    const target = createTarget({ get: () => committed, set: (v) => { committed = { ...v }; } });
    h.at(0);
    const none = h.animator.hold({ target, value: { x: 0, y: 1 }, weight: 0 });
    const full = h.animator.hold({ target, value: { x: 0, y: 0 }, weight: 1.5 });
    none.release();
    expect(committed).toEqual({ x: 0, y: 5 });
    full.release({ commit: false });
    expect(target.read()).toEqual({ x: 0, y: 5 });
  });
});
