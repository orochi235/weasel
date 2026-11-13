/**
 * An action's own key binding is held off while a gesture is in flight
 * (`BETWEEN_GESTURES`, or a phase of its own), so a key pressed mid-drag cannot
 * change what the drag is moving or swap the tool out from under it. A tool's
 * own keys are its gesture's (Enter finishes the pen's path) and are not read
 * here.
 */
import { describe, it, expect } from 'vitest';
import { sweepKit } from './kitSweep.fixture';

/** The action keys that run mid-drag on purpose, and why. */
const RUN_MID_GESTURE: Readonly<Record<string, string>> = {
  'viewport.zoom.in': 'moves only the view, which a drag reads each frame',
  'viewport.zoom.out': 'moves only the view',
  'viewport.zoom.reset': 'moves only the view',
  'viewport.zoom.fit': 'moves only the view',
  'exitPathEdit.key': "Escape, which cancelGesture's engaged-phase binding takes mid-drag",
  'tool.resetToDefault.key': "Escape, which cancelGesture's engaged-phase binding takes mid-drag",
  'keymap.pathfinder.leader': 'opens a keymap and changes nothing',
};

describe('kit key bindings between gestures', () => {
  const sweep = sweepKit();

  it('gives every action key a phase, but the ones that run mid-gesture on purpose', () => {
    const keys = sweep.found.filter((f) => f.where.includes(': action ') && f.binding.spec.kind === 'key');
    expect(keys.length).toBeGreaterThan(50);
    const open = keys
      .filter((f) => !('phase' in f.binding.spec) || f.binding.spec.phase === undefined)
      .map((f) => f.id ?? f.where)
      .filter((id) => !(id in RUN_MID_GESTURE));
    expect([...new Set(open)]).toEqual([]);
  });
});
