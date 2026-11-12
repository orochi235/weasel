/**
 * Path edit on the path a text-along effect hides, through a real `<SceneCanvas>` wired as Workspace
 * wires it, entered with the effect selected: the effect stays lit, and a click on its glyphs opens its text. The face draws each glyph
 * as a bar 20 wide and 50 tall on a 60 advance, standing on the path at y 50.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useState, type ReactElement } from 'react';
import { createScopingDim, DEFAULT_MODES } from '@weasel-js/modes';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { loadTextOutlines, type TextOutlineSource } from '@weasel-js/text';
import {
  SceneCanvas, asNodeId, createScene, hasEditablePath, PATH_EFFECT_DERIVATIONS, pathEffectNode, pathFromD,
  useDepSource, useSelection, withPathEffectsRegistry,
} from '@weasel-js/core';
import type { DrawScene } from '../drawDocument';
import { createModeMachine, type ModeMachine } from './machine';
import { modeScope } from './modeScope';
import { modePathEdit } from './pathEditHost';
import { useCanvasModes } from './useCanvasModes';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
});
afterEach(() => cleanup());

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};
const TEXT: TextOutlineSource = {
  text: 'Hi', style: { fontFamily: 'bars', fontSize: 100 }, fill: { paint: { kind: 'solid', color: '#000' } },
};

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}

function TextEditStub({ startEdit }: { startEdit: (id: string, opts?: object) => void }): null {
  useDepSource('textEdit', () => ({ startEdit }));
  return null;
}

function Harness({ machine, scene, startEdit, into }: {
  machine: ModeMachine; scene: DrawScene; startEdit: (id: string) => void; into: (alphaFor: (id: string) => number) => void;
}): ReactElement {
  const selection = useSelection({ mode: 'multi', scene, initial: [asNodeId('fx')] });
  const [pathEdit] = useState(() => modePathEdit(machine, (id) => hasEditablePath(scene.get(asNodeId(id)))));
  const [dim] = useState(() => createScopingDim({ registry: machine.registry, getTargetIds: modeScope(machine, scene) }));
  into(dim.alphaFor);
  const modes = useCanvasModes(machine, scene, selection, pathEdit);
  return (
    <SceneCanvas features={['draw']} scene={scene} selection={selection} layers={{}} width={400} height={120}
      ambient={modes.ambient} isPointerInteractive={dim.isPointerInteractive} modes={machine.registry} pathEdit={modes.pathEdit}>
      <TextEditStub startEdit={startEdit} />
    </SceneCanvas>
  );
}

async function setup(hideSources = true) {
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadTextOutlines(TEXT);
  const scene = createScene({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: asNodeId('t'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 400, height: 120 }, data: TEXT, hidden: hideSources },
      { id: asNodeId('p'), kind: 'mark', layer: 'main', pose: { x: 0, y: 50, width: 400, height: 1 }, data: { path: pathFromD('M0 50 L400 50') }, hidden: hideSources },
      { ...pathEffectNode({ kind: 'textAlong', hideSources }, [asNodeId('t'), asNodeId('p')], 'main', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') },
    ],
  } as never) as unknown as DrawScene;
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
  const startEdit = vi.fn();
  let alphaFor!: (id: string) => number;
  render(<Harness machine={machine} scene={scene} startEdit={startEdit} into={(a) => { alphaFor = a; }} />);
  act(() => machine.enterMode('path-edit', { targetId: 'p' }));
  const click = (x: number, y: number) => {
    const canvas = document.querySelector('canvas')!;
    const press = (type: string) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    act(() => { press('pointerdown'); press('pointerup'); });
  };
  return { alphaFor, click, startEdit };
}

describe('path edit on the path a text-along effect hides', () => {
  it('lights the effect and dims nothing it draws', async () => {
    const t = await setup();
    expect(t.alphaFor('p')).toBe(1);
    expect(t.alphaFor('fx')).toBe(1);
  });

  it('opens the text on a click on a glyph, caret at its end', async () => {
    const t = await setup();
    t.click(10, 30);
    expect(t.startEdit).toHaveBeenCalledWith('t', { caret: 2 });
  });

  it('opens nothing on a click between the glyphs', async () => {
    const t = await setup();
    t.click(40, 30);
    expect(t.startEdit).not.toHaveBeenCalled();
  });
});

describe('path edit on a path an effect shows', () => {
  it('dims the effect, which edits nothing through itself', async () => {
    const t = await setup(false);
    expect(t.alphaFor('fx')).toBeLessThan(1);
  });
});
