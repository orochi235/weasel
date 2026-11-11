/**
 * Property tests of the tree's move helpers and drop resolution on random trees: what a drag carries, where a
 * drop or a keyboard move lands, whether it lands inside what it carries, and whether it changes anything, each
 * checked against a plain model of the move. Also `filterTree`.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resolveDrop } from '../../dropTarget';
import { runs, tally, timeoutFor, uniform } from '../../pbt.fixture';
import { filterTree, treeBranchIds } from './treeFilter';
import { draggedIdsFor, isNoopMove, keyboardTarget, landsInside, nodeById, parentsOf, siblingsOf } from './treeMoves';
import { applyMove, branchIds, forest, idsOf, outline, rowsOf } from './tree.fixture';
import type { TreeNode } from './treeTypes';

const RUNS = 300;

/** A tree with something in it, a selection, and a node to drag from. */
const scene = forest.filter((f) => f.length > 0).chain((nodes) => {
  const ids = idsOf(nodes);
  return fc.record({
    nodes: fc.constant(nodes),
    selected: fc.subarray(ids).map((s) => new Set(s)),
    from: fc.constantFrom(...ids),
    expanded: fc.subarray(branchIds(nodes)).map((s) => new Set(s)),
  });
});

const ancestors = (parents: Map<string, string | null>, id: string): string[] => {
  const out: string[] = [];
  for (let p = parents.get(id) ?? null; p !== null; p = parents.get(p) ?? null) out.push(p);
  return out;
};

describe('draggedIdsFor', () => {
  it('carries the selection in tree order, less what travels with a selected ancestor, or the one node', () => {
    const t = tally();
    fc.assert(fc.property(scene, ({ nodes, selected, from }) => {
      const out = draggedIdsFor(nodes, selected, from);
      if (!selected.has(from)) { expect(out).toEqual([from]); t.count('alone'); return; }
      const parents = parentsOf(nodes);
      const order = idsOf(nodes);
      expect(out).toEqual(order.filter((id) => out.includes(id)));
      for (const id of selected) {
        const up = ancestors(parents, id).some((a) => selected.has(a));
        expect(out.includes(id)).toBe(!up);
        if (up) t.count('carried by ancestor');
      }
      expect(out.includes(from) || ancestors(parents, from).some((a) => out.includes(a))).toBe(true);
    }), runs(RUNS));
    t.atLeast('alone', 20);
    t.atLeast('carried by ancestor', 20);
  }, timeoutFor(RUNS, 2));
});

/** Every target a drop could name in `nodes`: each gap of each sibling list. */
const targetsOf = (nodes: readonly TreeNode[]) => [null, ...branchIds(nodes)].flatMap((parentId) =>
  Array.from({ length: siblingsOf(nodes, parentId).length + 1 }, (_, index) => ({ parentId, index })));

describe('landsInside and isNoopMove', () => {
  it('match the model: inside a carried node, and a move that leaves the tree as it was', () => {
    const t = tally();
    fc.assert(fc.property(scene.chain((s) => fc.record({ s: fc.constant(s), target: fc.constantFrom(...targetsOf(s.nodes)) })), ({ s, target }) => {
      const ids = draggedIdsFor(s.nodes, s.selected, s.from);
      const parents = parentsOf(s.nodes);
      const inside = target.parentId !== null && (ids.includes(target.parentId) || ancestors(parents, target.parentId).some((a) => ids.includes(a)));
      expect(landsInside(s.nodes, ids, target)).toBe(inside);
      if (inside) { t.count('inside'); return; }
      const same = JSON.stringify(outline(applyMove(s.nodes, ids, target))) === JSON.stringify(outline(s.nodes));
      expect(isNoopMove(s.nodes, ids, target)).toBe(same);
      t.count(same ? 'noop' : 'moves');
    }), runs(RUNS));
    t.atLeast('inside', 20);
    t.atLeast('noop', 20);
    t.atLeast('moves', 50);
  }, timeoutFor(RUNS, 3));
});

describe('keyboardTarget', () => {
  it('moves siblings one place, out after their parent, or into the end of the branch before them', () => {
    const t = tally();
    const arb = scene.chain((s) => {
      const parents = parentsOf(s.nodes);
      const p = parents.get(s.from) ?? null;
      const sibs = siblingsOf(s.nodes, p).map((n) => n.id);
      return fc.record({ s: fc.constant(s), ids: fc.oneof(fc.subarray(sibs, { minLength: 1 }), fc.constantFrom(...sibs).map((id) => [id])), move: fc.constantFrom('up', 'down', 'out', 'in' as const) });
    });
    fc.assert(fc.property(arb, ({ s, ids, move }) => {
      const parents = parentsOf(s.nodes);
      const parentId = parents.get(ids[0]!) ?? null;
      const sibs = siblingsOf(s.nodes, parentId).map((n) => n.id);
      const target = keyboardTarget(s.nodes, ids, move);
      const at = ids.map((id) => sibs.indexOf(id)).sort((a, b) => a - b);
      if (target === null) {
        t.count('stuck');
        if (move === 'up') expect(at[0]).toBe(0);
        if (move === 'down') expect(at.at(-1)).toBe(sibs.length - 1);
        if (move === 'out') expect(parentId).toBeNull();
        if (move === 'in') expect(at[0] === 0 || !nodeById(s.nodes, sibs[at[0]! - 1]!)?.children).toBe(true);
        return;
      }
      t.count(move);
      expect(landsInside(s.nodes, ids, target)).toBe(false);
      const after = applyMove(s.nodes, ids, target);
      expect(idsOf(after).sort()).toEqual(idsOf(s.nodes).sort());
      const moved = parentsOf(after);
      if (move === 'up' || move === 'down') {
        expect(target.parentId).toBe(parentId);
        // The run gathers beside the sibling past its far end, in its order.
        const now = siblingsOf(after, parentId).map((n) => n.id);
        const run = before(sibs, ids);
        const past = move === 'up' ? sibs[at[0]! - 1]! : sibs[at.at(-1)! + 1]!;
        const start = move === 'up' ? now.indexOf(past) - run.length : now.indexOf(past) + 1;
        expect(now.slice(start, start + run.length)).toEqual(run);
        if (move === 'up') expect(now[start + run.length]).toBe(past);
      } else if (move === 'out') {
        const grand = parents.get(parentId!) ?? null;
        const list = siblingsOf(after, grand).map((n) => n.id);
        const run = before(sibs, ids);
        expect(list.slice(list.indexOf(parentId!) + 1, list.indexOf(parentId!) + 1 + run.length)).toEqual(run);
        for (const id of ids) expect(moved.get(id)).toBe(grand);
      } else {
        const prev = sibs[at[0]! - 1]!;
        const list = siblingsOf(after, prev).map((n) => n.id);
        expect(list.slice(list.length - ids.length)).toEqual(before(sibs, ids));
      }
    }), runs(RUNS));
    for (const m of ['up', 'down', 'out', 'in', 'stuck']) t.atLeast(m, 4);
  }, timeoutFor(RUNS, 3));
});

/** `ids` in the order `list` holds them. */
function before(list: readonly string[], ids: readonly string[]): string[] {
  return list.filter((id) => ids.includes(id));
}

describe('resolveDrop', () => {
  it('names a real gap, marked on the row it is drawn against', () => {
    const t = tally();
    const arb = scene.chain((s) => fc.record({
      s: fc.constant(s),
      y: uniform(-30, rowsOf(s.nodes, s.expanded).length * 20 + 30),
      x: uniform(-20, 120),
      indent: fc.option(fc.record({ originX: fc.constantFrom(0, 8), indent: fc.constantFrom(0, 16, 24) }), { nil: undefined }),
    }));
    fc.assert(fc.property(arb, ({ s, x, y, indent }) => {
      const rows = rowsOf(s.nodes, s.expanded);
      const { target, mark } = resolveDrop(rows, { x, y }, indent);
      expect(mark).not.toBeNull();
      const row = rows.find((r) => r.id === mark!.id)!;
      expect(row).toBeDefined();
      t.count(mark!.where);
      if (mark!.where === 'into') {
        expect(row.branch).toBe(true);
        expect(target).toEqual({ parentId: row.id, index: row.childCount });
      } else {
        expect(target).toEqual({ parentId: row.parentId, index: row.index + (mark!.where === 'after' ? 1 : 0) });
      }
      const sibs = siblingsOf(s.nodes, target.parentId);
      expect(target.index >= 0 && target.index <= sibs.length).toBe(true);
      if (mark!.where === 'after' && rows.indexOf(row) < rows.length - 1 && row.level > 1 && indent?.indent) t.count('climbed');
    }), runs(RUNS));
    for (const w of ['before', 'after', 'into']) t.atLeast(w, 30);
  }, timeoutFor(RUNS, 2));

  it('never moves a drop back up the list as the pointer moves down', () => {
    const t = tally();
    const arb = scene.chain((s) => fc.record({ s: fc.constant(s), ys: fc.array(uniform(-10, rowsOf(s.nodes, s.expanded).length * 20 + 10), { minLength: 2, maxLength: 6 }) }));
    fc.assert(fc.property(arb, ({ s, ys }) => {
      const rows = rowsOf(s.nodes, s.expanded);
      // Where a drop draws, as a place in the list: before a row is its top, into it its middle, after it its bottom.
      const place = (y: number) => {
        const { mark } = resolveDrop(rows, { x: 0, y });
        const i = rows.findIndex((r) => r.id === mark!.id);
        const last = mark!.where === 'after' ? lastShown(rows, i) : i;
        return mark!.where === 'before' ? i * 3 : mark!.where === 'into' ? i * 3 + 1 : last * 3 + 2;
      };
      const sorted = [...ys].sort((a, b) => a - b);
      const at = sorted.map(place);
      for (let i = 1; i < at.length; i++) {
        // Below a collapsed or empty row's end, the gap after it and the gap before the next are one place.
        const a = at[i - 1]!; const b = at[i]!;
        expect(a <= b || (a % 3 === 2 && b === a + 1)).toBe(true);
        if (b > a) t.count('moved');
      }
    }), runs(RUNS));
    t.atLeast('moved', 50);
  }, timeoutFor(RUNS, 2));
});

/** The last row shown under row `i`, itself where nothing is. */
function lastShown(rows: readonly { level: number }[], i: number): number {
  let j = i;
  while (j + 1 < rows.length && rows[j + 1]!.level > rows[i]!.level) j++;
  return j;
}

describe('filterTree', () => {
  it('keeps each match whole and the branches above it, drops the rest, and hands back the tree untouched', () => {
    const t = tally();
    fc.assert(fc.property(forest, fc.func(fc.boolean()), (nodes, pick) => {
      const match = (n: TreeNode) => pick(n.id);
      const out = filterTree(nodes, match);
      const kept = new Set(idsOf(out));
      const parents = parentsOf(nodes);
      for (const id of idsOf(nodes)) {
        const n = nodeById(nodes, id)!;
        const hit = match(n) || ancestors(parents, id).some((a) => match(nodeById(nodes, a)!));
        const below = idsOf(n.children ?? []).some((d) => match(nodeById(nodes, d)!));
        expect(kept.has(id)).toBe(hit || below);
      }
      expect(idsOf(out)).toEqual(idsOf(nodes).filter((id) => kept.has(id)));
      for (const id of kept) if (match(nodeById(nodes, id)!)) expect(nodeById(out, id)).toBe(nodeById(nodes, id));
      if (kept.size === idsOf(nodes).length) { expect(out).toBe(nodes); t.count('whole'); } else t.count('cut');
      expect(treeBranchIds(out).every((id) => kept.has(id))).toBe(true);
    }), runs(RUNS));
    t.atLeast('whole', 20);
    t.atLeast('cut', 50);
  }, timeoutFor(RUNS, 2));
});
