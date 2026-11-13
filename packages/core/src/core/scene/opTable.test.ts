import { describe, expect, it } from 'vitest';
import type { HistoryStep } from '@weasel-js/history';
import { createScene } from './scene';
import type { RectPose } from '../geometry/unionBounds';

const make = () => createScene<{ fill: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });

describe('a scene op inverted', () => {
  it('describes the revert an observed undo replays, not the edit it undoes', () => {
    const scene = make();
    const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 5, height: 5 }, data: { fill: 'red' } });
    scene.setPose(id, { x: 9, y: 0, width: 5, height: 5 });
    const steps: HistoryStep[] = [];
    scene.history.observe((step) => steps.push(step));
    scene.undo();

    const [step] = steps;
    expect(step?.kind).toBe('undo');
    const forward = step!.entries[0]!.ops[0]!;
    const inverse = forward.invert();
    expect(inverse.name).not.toBe(forward.name);
    expect(inverse.invert().name).toBe(forward.name);
  });

  it('rebuilds from its name and args, in a restored history, as the revert it is', () => {
    const a = make();
    const id = a.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 5, height: 5 }, data: { fill: 'red' } });
    const pushed: HistoryStep[] = [];
    const stop = a.history.observe((step) => pushed.push(step));
    a.setPose(id, { x: 9, y: 0, width: 5, height: 5 });
    stop();
    const inverse = pushed[0]!.entries[0]!.ops[0]!.invert();
    const saved = a.serializeHistory();
    const revert = { name: inverse.name!, args: inverse.args };

    const b = make();
    b.loadState(a.toJSON());
    b.restoreHistory({
      ...saved,
      undoStack: [],
      redoStack: [{ id: 1, label: 'Revert', forwardOps: [revert], baseOps: [revert] }],
    });
    b.redo();
    expect(b.get(id)?.pose.x).toBe(0);
  });
});
