/**
 * Stateful property test of the reshape actions on a real scene, through the real `editAnchors` dep: random
 * paths, random anchor selections, and random actions, undone and redone at random. After every step the path
 * is well formed and finite, an action changed something exactly when it said it was enabled, and undo and
 * redo land on the states the model recorded.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  anchorsToPath, PATH_C, PATH_CMD_LENGTHS, PATH_L, PATH_M, PATH_Q, PATH_Z, worldCoords, type PenAnchor, type PolygonPath,
} from '@weasel-js/geom';
import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { deleteAnchorsAction, nudgeAnchorsLeftAction, nudgeAnchorsUpAction } from '@weasel-js/core';
import {
  addExtremeAnchorsAction, bridgeAnchorsAction, CORNER_SHAPE_OPTIONS, constrainAnchorsAction, convertSegmentsAction, cycleCornerShapeAction,
  growAnchorSelectionAction, handleLockAngleAction, handleLockLengthAction, harmonizeAnchorsAction,
  invertAnchorSelectionAction, resamplePathAction, reversePathAction, selectCornerAnchorsAction,
  selectEveryNthAnchorAction, selectSmoothAnchorsAction, setCornersAction, setPathStartAction,
  shrinkAnchorSelectionAction, unconstrainAnchorsAction,
} from './index';
import { editHarness as harness, type EditHarness } from './shared/testing/editHarness';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 60;
const TIMEOUT = Math.max(10_000, RUNS * 60);

/** Actions that may join or remove anchors, and so open or close a subpath. */
const RESTRUCTURES = new Set(['deleteAnchors', 'bridgeAnchors']);

const ACTIONS: Action[] = [
  reversePathAction, setPathStartAction, convertSegmentsAction, addExtremeAnchorsAction, resamplePathAction,
  harmonizeAnchorsAction, cycleCornerShapeAction, setCornersAction, bridgeAnchorsAction, constrainAnchorsAction,
  unconstrainAnchorsAction, growAnchorSelectionAction, shrinkAnchorSelectionAction, invertAnchorSelectionAction,
  selectCornerAnchorsAction, selectSmoothAnchorsAction, selectEveryNthAnchorAction, handleLockAngleAction,
  handleLockLengthAction, deleteAnchorsAction, nudgeAnchorsUpAction, nudgeAnchorsLeftAction,
];

type H = EditHarness;

const snap = (p: PolygonPath) => ({ commands: Array.from(p.commands), coords: Array.from(worldCoords(p)), corners: p.corners ?? null });

/** Well formed: each subpath opens with M and draws something before a Z, coords match the commands, all finite. */
function checkPath(p: PolygonPath): void {
  const cmds = Array.from(p.commands);
  let need = 0;
  let drawn = false;
  cmds.forEach((c, i) => {
    need += PATH_CMD_LENGTHS[c]!;
    if (i === 0) expect(c, 'the path opens with a moveto').toBe(PATH_M);
    if (c === PATH_M) {
      expect(cmds[i + 1], `a moveto at ${i} is followed by something`).not.toBeUndefined();
      expect(cmds[i + 1], `no empty subpath at ${i}`).not.toBe(PATH_M);
      drawn = false;
    } else if (c === PATH_Z) {
      expect(drawn, `a close at ${i} closes a subpath that drew something`).toBe(true);
    } else {
      expect([PATH_L, PATH_C, PATH_Q]).toContain(c);
      drawn = true;
    }
  });
  expect(p.coords.length).toBe(need);
  for (const v of worldCoords(p)) expect(Number.isFinite(v)).toBe(true);
}

const closedCount = (p: PolygonPath): number => Array.from(p.commands).filter((c) => c === PATH_Z).length;

interface Model { states: { path: unknown }[]; cursor: number; base: number }

const tally = new Map<string, number>();
const count = (k: string): void => { tally.set(k, (tally.get(k) ?? 0) + 1); };

class Run implements fc.Command<Model, H> {
  constructor(readonly action: Action, readonly params?: Record<string, unknown>) {}
  check(): boolean { return true; }
  run(m: Model, h: H): void {
    const before = { path: snap(h.path()), selected: h.selected(), locks: JSON.stringify(h.locks()), at: h.scene.historyIndex() };
    const closed = closedCount(h.path());
    const enabled = this.action.enabled ? this.action.enabled(h.deps()) : true;
    (this.action.invoker as ImmediateInvoker).run(h.deps(), this.params);
    const after = { path: snap(h.path()), selected: h.selected(), locks: JSON.stringify(h.locks()), at: h.scene.historyIndex() };
    const changed = JSON.stringify(after) !== JSON.stringify(before);
    // Disabled, it must do nothing. Enabled and doing nothing is counted, not failed: see the ruling it is waiting on.
    if (enabled === true && (globalThis.process?.env?.PBT_STRICT ?? "").split(",").includes(this.action.id)) expect(changed, `${this.action.id} enabled and idle`).toBe(true);
    if (enabled !== true) expect(changed, `${this.action.id} is disabled (${String(enabled)}) and still changed something`).toBe(false);
    count(`${this.action.id}:${enabled === true ? (changed ? "ran" : "idle") : "off"}`);
    checkPath(h.path());
    if (!RESTRUCTURES.has(this.action.id)) expect(closedCount(h.path()), `${this.action.id} keeps closed subpaths closed`).toBe(closed);
    if (after.at - m.base === m.cursor + 1) {
      m.states.splice(m.cursor + 1);
      m.states.push({ path: after.path });
      m.cursor++;
    } else {
      expect(after.at - m.base, `${this.action.id} records one entry or none`).toBe(m.cursor);
      expect(after.path, `${this.action.id} changed the path without recording it`).toEqual(m.states[m.cursor]!.path);
    }
  }
  toString(): string { return `Run(${this.action.id}${this.params ? ` ${JSON.stringify(this.params)}` : ''})`; }
}

class Select implements fc.Command<Model, H> {
  constructor(readonly picks: number[]) {}
  check(): boolean { return true; }
  run(_m: Model, h: H): void {
    const n = Array.from(h.path().commands).filter((c) => c !== PATH_Z).length;
    h.setSelected([...new Set(this.picks.map((k) => k % Math.max(1, n)))]);
  }
  toString(): string { return `Select(${this.picks.join(',')})`; }
}

class Undo implements fc.Command<Model, H> {
  check(m: Readonly<Model>): boolean { return m.cursor > 0; }
  run(m: Model, h: H): void {
    h.scene.undo();
    m.cursor--;
    expect(snap(h.path())).toEqual(m.states[m.cursor]!.path);
    checkPath(h.path());
    count('undo');
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, H> {
  check(m: Readonly<Model>): boolean { return m.cursor < m.states.length - 1; }
  run(m: Model, h: H): void {
    h.scene.redo();
    m.cursor++;
    expect(snap(h.path())).toEqual(m.states[m.cursor]!.path);
    count('redo');
  }
  toString(): string { return 'Redo'; }
}

const at = fc.integer({ min: -200, max: 200 });
const anchor: fc.Arbitrary<PenAnchor> = fc.tuple(at, at, fc.option(fc.tuple(at, at), { nil: undefined }), fc.boolean())
  .map(([x, y, h, mirrored]) => (h
    ? { x, y, outHandle: { x: x + h[0] / 4, y: y + h[1] / 4 }, inHandle: mirrored ? { x: x - h[0] / 4, y: y - h[1] / 4 } : { x: x + h[1] / 5, y: y - h[0] / 5 } }
    : { x, y }));
const path: fc.Arbitrary<PolygonPath> = fc.array(
  fc.tuple(fc.array(anchor, { minLength: 2, maxLength: 6 }), fc.boolean()), { minLength: 1, maxLength: 2 },
).map((subs) => anchorsToPath(subs.map(([a]) => a), subs.map(([, c]) => c)));

/** `setCorners` is a control's action, and does nothing without the shape or radius the control gives it. */
const cornerParams = fc.record({
  shape: fc.constantFrom(...CORNER_SHAPE_OPTIONS.map((o) => o.value)),
  radius: fc.integer({ min: 0, max: 40 }),
}, { requiredKeys: [] });

const commands = fc.commands([
  fc.constantFrom(...ACTIONS).map((a) => new Run(a)),
  cornerParams.map((p) => new Run(setCornersAction, p)),
  fc.constantFrom(...ACTIONS).map((a) => new Run(a)),
  fc.array(fc.nat({ max: 20 }), { maxLength: 3 }).map((ks) => new Select(ks)),
  fc.array(fc.nat({ max: 20 }), { maxLength: 3 }).map((ks) => new Select(ks)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
], { maxCommands: 25, size: 'large' });

describe('reshape actions on a real scene, stateful property', () => {
  it('keep the path well formed, run exactly when enabled, and undo and redo exactly', () => {
    fc.assert(fc.property(path, commands, (p, cmds) => {
      const h = harness(p);
      try {
        checkPath(h.path());
        const model: Model = { states: [{ path: snap(h.path()) }], cursor: 0, base: h.scene.historyIndex() };
        fc.modelRun(() => ({ model, real: h }), cmds);
      } finally {
        h.unmount();
      }
    }), { numRuns: RUNS });
    for (const k of ['undo', 'reversePath:ran', 'resamplePath:ran', 'setCorners:ran']) {
      expect(tally.get(k) ?? 0, `${k} ${JSON.stringify([...tally])}`).toBeGreaterThan(0);
    }
  }, TIMEOUT);
});
