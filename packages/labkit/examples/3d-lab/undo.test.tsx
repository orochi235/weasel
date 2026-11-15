/**
 * The lab's Undo and Redo, buttons and Mod+Z alike, step the scene's own
 * history: a solid inserted is taken back by the trial's Undo, one step per press.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { createInsertOp, defaultCommitAdapter } from '@weasel-js/core/engine';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Lab } from '../../src/lab/Lab';
import { pose3, type SolidScene } from './scene3d';
import { SolidInstrument } from './SolidInstrument';

const made: SolidScene[] = [];
vi.mock('./scene3d', async (importOriginal) => {
  const real = await importOriginal<typeof import('./scene3d')>();
  return {
    ...real,
    createSolidScene: () => {
      const scene = real.createSolidScene();
      made.push(scene);
      return scene;
    },
  };
});

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const scene = (): SolidScene => made.at(-1)!;
const count = () => scene().renderOrderNodes().length;

function insertBox(): void {
  const s = scene();
  const id = s.mintId();
  const node = {
    id,
    kind: 'mark' as const,
    layer: 'solids' as const,
    parent: null,
    pose: pose3({ x: 0, y: 0.5, z: -3 }),
    data: { kind: 'box' as const, color: '#c49a3f' },
  };
  act(() => {
    s.applyBatch([createInsertOp({ node, label: 'Insert box' })], 'Insert box', defaultCommitAdapter(s as never));
  });
}

const press = (name: 'Undo' | 'Redo') => fireEvent.click(screen.getByRole('button', { name }));
const chord = (shift = false) =>
  act(() => {
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: shift });
  });

describe("the 3D lab's undo", () => {
  it("takes back an insert with the trial's Undo button and makes it again with Redo", async () => {
    await renderSettled(<Lab instruments={[SolidInstrument]} />, { wrapper: withIcons });
    const before = count();
    insertBox();
    expect(count()).toBe(before + 1);
    press('Undo');
    expect(count()).toBe(before);
    press('Redo');
    expect(count()).toBe(before + 1);
  });

  it('steps one insert per Mod+Z press', async () => {
    await renderSettled(<Lab instruments={[SolidInstrument]} />, { wrapper: withIcons });
    const before = count();
    insertBox();
    insertBox();
    chord();
    expect(count()).toBe(before + 1);
    chord(true);
    expect(count()).toBe(before + 2);
  });

  it('steps one insert per Mod+Z press inside the viewport, where the kit binds undo too', async () => {
    const { container } = await renderSettled(<Lab instruments={[SolidInstrument]} />, { wrapper: withIcons });
    const pane = container.querySelector('.td-pane')!;
    const before = count();
    insertBox();
    insertBox();
    // A press in the pane makes it the surface keys reach.
    act(() => {
      pane.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
      pane.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 }));
    });
    act(() => {
      fireEvent.keyDown(pane, { key: 'z', ctrlKey: true });
    });
    expect(count()).toBe(before + 1);
  });

  it('draws no undo or redo buttons of its own', async () => {
    await renderSettled(<Lab instruments={[SolidInstrument]} />, { wrapper: withIcons });
    expect(screen.queryByRole('button', { name: 'undo' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
  });
});
