import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  ActionsProvider,
  createMeasurements,
  createScene,
  DepRegistryProvider,
  measureIds,
  measureNode,
  measurementsContribution,
  useDepSource,
  type DepName,
  type NodeId,
  type Scene,
} from '@weasel-js/core';
import { MeasureReadout } from './MeasureReadout';
import { RegisterActions } from '../../testing/registerAction';

type AnyScene = Scene<unknown, string, unknown>;

function Deps({ scene, selected }: { scene: AnyScene; selected: string[] }) {
  useDepSource('scene' as DepName, () => scene as never);
  useDepSource('selection' as DepName, () => ({ get: () => selected, set: () => {} }) as never);
  return null;
}

function setup() {
  const scene = createScene<unknown, 'main' | 'notes', unknown>({
    systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
  }) as unknown as AnyScene;
  const ms = createMeasurements({ layer: 'notes' });
  const add = (id: string, a: { x: number; y: number }, b: { x: number; y: number }) =>
    act(() => { scene.add(measureNode(id as NodeId, 'notes', a, b) as never); });
  const actions = measurementsContribution(scene, ms).actions ?? [];
  const view = (selected: string[]) => (
    <DepRegistryProvider>
      <ActionsProvider>
        <Deps scene={scene} selected={selected} />
        <RegisterActions actions={actions} />
        <MeasureReadout scene={scene} measurements={ms} />
      </ActionsProvider>
    </DepRegistryProvider>
  );
  return { scene, ms, add, view };
}

const values = () => screen.getAllByRole('status').map((el) => el.textContent);
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('MeasureReadout', () => {
  it('shows nothing until something is measured', () => {
    const rig = setup();
    const { container } = render(rig.view([]));
    expect(container.firstChild).toBeNull();
  });

  it('reads the newest measurement, and the picked one once one is picked', () => {
    const rig = setup();
    render(rig.view(['box']));
    rig.add('a', { x: 10, y: 10 }, { x: 40, y: -30 });
    rig.add('b', { x: 0, y: 0 }, { x: 5, y: 0 });
    expect(values()).toEqual(['5.00', '5.00', '0.00', '0.00°']);
    act(() => rig.ms.picked.set('a' as NodeId));
    expect(values()).toEqual(['50.00', '30.00', '−40.00', '53.13°']);
  });

  it('reads a measure drag in progress over the rest', () => {
    const rig = setup();
    render(rig.view(['box']));
    rig.add('a', { x: 0, y: 0 }, { x: 5, y: 0 });
    act(() => rig.ms.draft.set({ start: { x: 0, y: 0 }, end: { x: 0, y: 7 }, dx: 0, dy: 7, distance: 7, angle: -Math.PI / 2 }));
    expect(values()[0]).toBe('7.00');
  });

  it('greys out Move by and Rotate by with nothing selected, and says why', () => {
    const rig = setup();
    render(rig.view([]));
    rig.add('a', { x: 0, y: 0 }, { x: 5, y: 0 });
    const move = button('Move by');
    expect(move.getAttribute('aria-disabled')).toBe('true');
    // Kept focusable, so its tooltip can say why.
    expect(move.disabled).toBe(false);
    expect(move.getAttribute('aria-description')).toBe('Selection required');
    expect(button('Rotate by').getAttribute('aria-disabled')).toBe('true');
    expect(button('Delete').getAttribute('aria-disabled')).toBeNull();
  });

  it('deletes the current measurement, and clears them all', () => {
    const rig = setup();
    render(rig.view([]));
    rig.add('a', { x: 0, y: 0 }, { x: 5, y: 0 });
    rig.add('b', { x: 0, y: 0 }, { x: 9, y: 0 });
    fireEvent.click(button('Delete'));
    expect(measureIds(rig.scene, rig.ms)).toEqual(['a']);
    fireEvent.click(button('Clear all'));
    expect(measureIds(rig.scene, rig.ms)).toEqual([]);
  });
});
