import { describe, it, expect } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import {
  asNodeId,
  rotationDegreesUnit,
  type NodePropertiesEntry,
} from '@weasel-js/core';
import type { PrefSection } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';
import {
  type Data,
  type Pose,
  routing,
  properties,
  makeScene,
  selectionOf,
} from './testing/rectScene';

describe('SelectionPanel', () => {

  it('editing a number fans out to every selected node in one undo step', () => {
    const scene = makeScene();
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a', 'b'])}
        properties={properties}
        routing={routing}
      />,
    );
    const y = screen.getByLabelText('Position Y');
    fireEvent.change(y, { target: { value: '99' } });
    fireEvent.blur(y);
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.y).toBe(99);
    expect((scene.get(asNodeId('b')) as { pose: Pose }).pose.y).toBe(99);
    act(() => scene.undo());
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.y).toBe(20);
    expect((scene.get(asNodeId('b')) as { pose: Pose }).pose.y).toBe(20);
  });

  it('round-trips number units: radians stored, degrees displayed', () => {
    const scene = makeScene();
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    const rotation = screen.getByLabelText('Rotation');
    expect(rotation).toHaveValue('45'); // Math.PI / 4 stored
    fireEvent.change(rotation, { target: { value: '90' } });
    fireEvent.blur(rotation);
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('reads a unit typed into a unit leaf', () => {
    const scene = makeScene();
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    const rotation = screen.getByLabelText('Rotation');
    fireEvent.change(rotation, { target: { value: '0.25turn' } });
    fireEvent.blur(rotation);
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.rotation).toBeCloseTo(Math.PI / 2);
  });

  // A leaf's bounds are written in the unit it stores, like its value. Passed
  // through raw they clamped typed degrees against a radian range: 90 came
  // back as 6.283 (2π), the max.
  it('converts a unit leaf\'s bounds into the unit it displays', () => {
    const scene = makeScene();
    const layout = properties[0]!.schema.members.layout as PrefSection;
    const bounded: NodePropertiesEntry[] = [
      {
        ...properties[0]!,
        schema: {
          ...properties[0]!.schema,
          members: {
            ...properties[0]!.schema.members,
            layout: {
              ...layout,
              members: {
                ...layout.members,
                'pose.rotation': {
                  kind: 'number',
                  name: 'Rotation',
                  description: 'r',
                  default: 0,
                  min: 0,
                  max: Math.PI * 2,
                  step: Math.PI / 180,
                  unit: rotationDegreesUnit,
                },
              },
            },
          },
        },
      },
    ];
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a'])}
        properties={bounded}
        routing={routing}
      />,
    );
    const rotation = screen.getByLabelText('Rotation');
    fireEvent.change(rotation, { target: { value: '90' } });
    fireEvent.blur(rotation);
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('clearing a number field writes nothing and adds no undo entry', () => {
    const scene = makeScene();
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    const before = scene.historyIndex();
    const y = screen.getByLabelText('Position Y');
    fireEvent.change(y, { target: { value: '' } });
    fireEvent.blur(y);
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.y).toBe(20);
    expect(scene.historyIndex()).toBe(before);
  });

  it('string input commits exactly once on Enter', () => {
    const scene = makeScene();
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    const before = scene.historyIndex();
    const label = screen.getByLabelText('Label');
    act(() => label.focus());
    fireEvent.change(label, { target: { value: 'world' } });
    fireEvent.keyDown(label, { key: 'Enter' });
    fireEvent.blur(label); // must be a no-op: Enter already committed
    expect((scene.get(asNodeId('a')) as { data: Data }).data.label).toBe('world');
    expect(scene.historyIndex()).toBe(before + 1);
  });

  it('string input blur without an edit commits nothing', () => {
    const scene = makeScene();
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    const before = scene.historyIndex();
    const label = screen.getByLabelText('Label');
    act(() => label.focus());
    fireEvent.blur(label);
    expect((scene.get(asNodeId('a')) as { data: Data }).data.label).toBe('hello');
    expect(scene.historyIndex()).toBe(before);
  });
});
