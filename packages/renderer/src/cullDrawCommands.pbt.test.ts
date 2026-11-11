import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { boundsMissRect, cullDrawCommands } from './cullDrawCommands';
import type { DrawCommand } from './DrawCommand';
import { checkCull, dpr, IMAGE, near, tree, view } from './cullTree.fixture';
import { runs, spread, tally, timeoutFor } from './pbt.fixture';

describe('cullDrawCommands, property', () => {
  it('drops commands without reordering or changing the rest, and keeps every one that paints in view', () => {
    const t = tally();
    fc.assert(fc.property(tree, near, view, dpr, (cmds, m, rect, d) => {
      const out = cullDrawCommands(cmds, m, rect, d);
      checkCull(cmds, out, m, rect, d, t);
    }), runs(1000));
    t.atLeast('leaf must stay', 25);
    t.atLeast('moved leaf must stay', 25);
    t.atLeast('group must stay', 100);
    t.atLeast('dropped', 200);
  }, timeoutFor(1000, 10));

  it('returns its input when it drops nothing, and is idempotent', () => {
    const t = tally();
    fc.assert(fc.property(tree, near, view, dpr, (cmds, m, rect, d) => {
      const out = cullDrawCommands(cmds, m, rect, d);
      t.count(out === cmds ? 'same' : 'culled');
      expect(cullDrawCommands(out, m, rect, d)).toBe(out);
    }), runs(300));
    t.atLeast('same', 30);
    t.atLeast('culled', 30);
  }, timeoutFor(300, 10));

  it('drops an image exactly when boundsMissRect says its rect misses', () => {
    const t = tally();
    fc.assert(fc.property(fc.tuple(spread(-300, 300), spread(-300, 300), spread(-200, 200), spread(-200, 200)), near, view, ([x, y, w, h], m, rect) => {
      const cmd: DrawCommand = { kind: 'image', image: IMAGE, x, y, w, h };
      const miss = boundsMissRect({ x, y, width: w, height: h }, m, rect);
      t.count(miss ? 'miss' : 'meet');
      expect(cullDrawCommands([cmd], m, rect, 1).length).toBe(miss ? 0 : 1);
    }), runs(300));
    t.atLeast('miss', 30);
    t.atLeast('meet', 8);
  });
});
