import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, type NodePropertiesEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { makeScene, routing, selectionOf, type Pose } from './testing/rectScene';

const properties: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      members: {
        // y, which both nodes share: a mixed slider is disabled and drops every change.
        'pose.y': { kind: 'number', name: 'Y', description: 'y', default: 0, control: 'slider', min: 0, max: 100 },
      },
    },
  },
];

function mount() {
  const scene = makeScene();
  render(<SelectionPanel scene={scene} selection={selectionOf(['a', 'b'])} properties={properties} routing={routing} />);
  const yOf = (id: string) => (scene.get(asNodeId(id)) as { pose: Pose }).pose.y;
  return { scene, yOf, slider: screen.getByRole('slider') };
}

/** A drag as the browser reports it: `input` on every move, one `change` when the thumb is let go. */
function drag(slider: HTMLElement, values: number[]) {
  for (const value of values) fireEvent.input(slider, { target: { value: String(value) } });
}
const letGo = (slider: HTMLElement) => fireEvent(slider, new Event('change', { bubbles: true }));

describe('a slider dragged in a SelectionPanel', () => {
  it('moves the nodes with the thumb', () => {
    const { slider, yOf } = mount();
    drag(slider, [30, 40]);
    expect([yOf('a'), yOf('b')]).toEqual([40, 40]);
  });

  it('leaves one undo step, back to where the nodes were before the drag', () => {
    const { scene, slider, yOf } = mount();
    const before = scene.historyEntries().length;
    drag(slider, [30, 40, 60]);
    expect(scene.historyEntries()).toHaveLength(before);
    letGo(slider);
    expect(scene.historyEntries()).toHaveLength(before + 1);
    expect([yOf('a'), yOf('b')]).toEqual([60, 60]);

    act(() => scene.undo());
    expect([yOf('a'), yOf('b')]).toEqual([20, 20]);
    act(() => scene.redo());
    expect([yOf('a'), yOf('b')]).toEqual([60, 60]);
  });

  it('starts the next drag from what the last one left', () => {
    const { scene, slider, yOf } = mount();
    drag(slider, [30]);
    letGo(slider);
    drag(slider, [70, 80]);
    letGo(slider);
    act(() => scene.undo());
    expect([yOf('a'), yOf('b')]).toEqual([30, 30]);
  });
});
