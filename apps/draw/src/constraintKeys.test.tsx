/**
 * Draw's keys for path constraints: in path edit, Alt+Shift and a letter adds
 * that kind of constraint to the selected anchors, and Alt+Shift+U removes them.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider, DepRegistryProvider, SceneCanvas, asNodeId, createScene, pathFromD, useActionsRegistry,
  type PathConstraint, type PolygonPath,
} from '@weasel-js/core';
import { browserReservedChord } from '@weasel-js/routing';
import type { KeySpec } from '@weasel-js/gestures';
import { constrainAnchorsAction, constraintsPreset, unconstrainAnchorsAction } from '@weasel-js/path-tools';
import { useMemo } from 'react';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { createModeMachine } from './modality/machine';
import { modePathEdit } from './modality/pathEditHost';
import { DRAW_TUNE } from './constraintKeys';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

const A = asNodeId('a');
const FEATURES = ['draw', constraintsPreset] as const;
type Pose = { x: number; y: number; width: number; height: number };
type Data = { path: PolygonPath; constraints?: PathConstraint[] };

function setup() {
  const history = {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
  const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: A, kind: 'mark', layer: 'main',
    data: { path: pathFromD('M 0 0 L 20 4 L 20 20') as PolygonPath },
    pose: { x: 10, y: 10, width: 20, height: 20 },
  });
  scene.setSelection([A]);
  const grabbed: { trigger?: (id: string) => void } = {};
  function Harness() {
    const actions = useActionsRegistry();
    grabbed.trigger = (id) => { actions?.trigger(id); };
    const pathEdit = useMemo(() => modePathEdit(machine, () => true), []);
    return (
      <SceneCanvas features={FEATURES} scene={scene} layers={{}} width={128} height={128}
        modes={machine.registry} pathEdit={pathEdit} tune={DRAW_TUNE} />
    );
  }
  const { container } = render(<DepRegistryProvider><ActionsProvider><Harness /></ActionsProvider></DepRegistryProvider>);
  act(() => grabbed.trigger!('enterPathEdit'));
  const canvas = container.querySelector('canvas')!;
  return { scene, canvas };
}

// jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
function click(canvas: HTMLCanvasElement, [x, y]: [number, number], shiftKey = false) {
  const at = (type: string) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, shiftKey }));
  act(() => { at('pointerdown'); at('pointerup'); });
}

/** Alt+Shift and `letter`, as a Mac reports it: Alt makes `key` another glyph, so only `code` names the letter. */
function altShift(letter: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: '\u02dd', code: `Key${letter.toUpperCase()}`, altKey: true, shiftKey: true, bubbles: true,
    }));
  });
}

const constraints = (scene: ReturnType<typeof setup>['scene']) => scene.get(A)!.data.constraints ?? [];

describe("draw's constraint keys", () => {
  it('adds the kind its letter names to the selected anchors, and Alt+Shift+U removes them', () => {
    const { scene, canvas } = setup();
    // The first two anchors, at world (10, 10) and (30, 14).
    click(canvas, [10, 10]);
    click(canvas, [30, 14], true);
    altShift('h');
    expect(constraints(scene)).toEqual([{ kind: 'horizontal', segment: [0, 1] }]);
    altShift('f');
    expect(constraints(scene)).toEqual([
      { kind: 'horizontal', segment: [0, 1] }, { kind: 'fixed', anchor: 0 }, { kind: 'fixed', anchor: 1 },
    ]);
    altShift('u');
    expect(constraints(scene)).toEqual([]);
  });

  it('binds no chord a browser takes first', () => {
    const tuned = [constrainAnchorsAction, unconstrainAnchorsAction].flatMap((action) =>
      (DRAW_TUNE[action.id]?.bindings ?? []).map((b) => ('spec' in b ? b.spec : b)));
    expect(tuned.length).toBeGreaterThan(0);
    expect(tuned.filter((spec) => spec.kind === 'key' && browserReservedChord(spec as KeySpec))).toEqual([]);
  });

  it('gives each action a glyph of its own', () => {
    expect(constrainAnchorsAction.icon).toBe('path-tools:constrainAnchors');
    expect(unconstrainAnchorsAction.icon).toBe('path-tools:unconstrainAnchors');
  });
});
