import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, type NodePropertiesEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { makeScene, routing, selectionOf, type Pose } from './testing/rectScene';

const properties: NodePropertiesEntry[] = [{
  name: 'rect',
  schema: {
    name: 'Properties',
    members: { 'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0, min: 0, max: 100 } },
  },
}];

function type(text: string) {
  const scene = makeScene();
  render(<SelectionPanel scene={scene} selection={selectionOf(['a', 'b'])} properties={properties} routing={routing} />);
  const xOf = (id: string) => (scene.get(asNodeId(id)) as { pose: Pose }).pose.x;
  const field = screen.getByLabelText('X');
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
  return { scene, xOf };
}

describe('an offset typed into a mixed number in a SelectionPanel', () => {
  it('moves each node by the amount from its own value, in one undo step', () => {
    const { scene, xOf } = type('+=5');
    expect([xOf('a'), xOf('b')]).toEqual([15, 55]);
    act(() => scene.undo());
    expect([xOf('a'), xOf('b')]).toEqual([10, 50]);
  });

  it("holds each node's result inside the leaf's bounds", () => {
    const { xOf } = type('-=20');
    expect([xOf('a'), xOf('b')]).toEqual([0, 30]);
  });
});
