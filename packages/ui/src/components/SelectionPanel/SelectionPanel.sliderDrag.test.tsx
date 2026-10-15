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
        'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0, control: 'slider', min: 0, max: 100 },
      },
    },
  },
];

function mount() {
  const scene = makeScene();
  render(<SelectionPanel scene={scene} selection={selectionOf(['a', 'b'])} properties={properties} routing={routing} />);
  const xOf = (id: string) => (scene.get(asNodeId(id)) as { pose: Pose }).pose.x;
  return { scene, xOf, slider: screen.getByRole('slider') };
}

/** A drag as the browser reports it: `input` on every move, one `change` when the thumb is let go. */
function drag(slider: HTMLElement, values: number[]) {
  for (const value of values) fireEvent.input(slider, { target: { value: String(value) } });
}
const letGo = (slider: HTMLElement) => fireEvent(slider, new Event('change', { bubbles: true }));

describe('a slider dragged in a SelectionPanel', () => {
  it('moves the nodes with the thumb', () => {
    const { slider, xOf } = mount();
    drag(slider, [30, 40]);
    expect([xOf('a'), xOf('b')]).toEqual([40, 40]);
  });

  it('leaves one undo step, back to where each node was before the drag', () => {
    const { scene, slider, xOf } = mount();
    const before = scene.historyEntries().length;
    drag(slider, [30, 40, 60]);
    expect(scene.historyEntries()).toHaveLength(before);
    letGo(slider);
    expect(scene.historyEntries()).toHaveLength(before + 1);
    expect([xOf('a'), xOf('b')]).toEqual([60, 60]);

    act(() => scene.undo());
    expect([xOf('a'), xOf('b')]).toEqual([10, 50]);
    act(() => scene.redo());
    expect([xOf('a'), xOf('b')]).toEqual([60, 60]);
  });

  it('starts the next drag from what the last one left', () => {
    const { scene, slider, xOf } = mount();
    drag(slider, [30]);
    letGo(slider);
    drag(slider, [70, 80]);
    letGo(slider);
    act(() => scene.undo());
    expect([xOf('a'), xOf('b')]).toEqual([30, 30]);
  });
});
