import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  rotationDegreesUnit,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type SelectionApi,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';

interface Data { kind: string; fill?: string; label?: string }
type Layer = 'default';
interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

const routing: NodeRoutingEntry[] = [
  { name: 'rect', matches: (d) => (d as Data)?.kind === 'rect' },
  { name: 'text', matches: (d) => (d as Data)?.kind === 'text' },
];

const properties: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      children: {
        layout: {
          name: 'Layout',
          children: {
            'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0, pair: 'Position' },
            'pose.y': { kind: 'number', name: 'Y', description: 'y', default: 0, pair: 'Position' },
            'pose.rotation': { kind: 'number', name: 'Rotation', description: 'r', default: 0, unit: rotationDegreesUnit },
          },
        },
        appearance: {
          name: 'Appearance',
          children: {
            'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000000ff', alpha: true },
            'data.label': { kind: 'string', name: 'Label', description: 'l', default: '' },
          },
        },
      },
    },
  },
];

function makeScene() {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'default', pose: { x: 10, y: 20, width: 30, height: 40, rotation: Math.PI / 4 }, data: { kind: 'rect', fill: '#ff0000ff', label: 'hello' } });
  scene.add({ id: asNodeId('b'), kind: 'leaf', layer: 'default', pose: { x: 50, y: 20, width: 30, height: 40 }, data: { kind: 'rect', fill: '#00ff00ff' } });
  return scene;
}

const selectionOf = (ids: string[]): SelectionApi =>
  ({ current: ids } as unknown as SelectionApi);

describe('SelectionPanel', () => {
  it('renders empty state with no selection', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf([])}
        properties={properties}
        routing={routing}
        emptyState={<em>Nothing selected</em>}
      />,
    );
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('shows kind header, sections, and values for a single node', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
      />,
    );
    expect(screen.getByText('Rect')).toBeInTheDocument();
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByLabelText('Position X')).toHaveValue('10');
    expect(screen.getByLabelText('Fill')).toHaveValue('#ff0000');
  });

  it('multi-select shows count header and Mixed placeholders', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a', 'b'])}
        properties={properties}
        routing={routing}
      />,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('rect ×2')).toBeInTheDocument();
    expect(screen.getByLabelText('Position X')).toHaveAttribute('placeholder', 'Mixed');
    expect(screen.getByLabelText('Position Y')).toHaveValue('20'); // shared value renders
  });

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
    scene.undo();
    expect((scene.get(asNodeId('a')) as { pose: Pose }).pose.y).toBe(20);
    expect((scene.get(asNodeId('b')) as { pose: Pose }).pose.y).toBe(20);
  });

  it('custom renderer overrides a built-in kind', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
        renderers={{ color: (ctx) => <button type="button">custom:{ctx.path}</button> }}
      />,
    );
    expect(screen.getByText('custom:data.fill')).toBeInTheDocument();
  });

  it('kindLabel overrides the header derivation', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={properties}
        routing={routing}
        kindLabel={(k) => `<${k}>`}
      />,
    );
    expect(screen.getByText('<rect>')).toBeInTheDocument();
  });

  it('ignores dead selection ids and renders from live nodes', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a', 'zombie'])}
        properties={properties}
        routing={routing}
        emptyState={<em>Nothing selected</em>}
      />,
    );
    expect(screen.getByText('Rect')).toBeInTheDocument();
    expect(screen.getByLabelText('Position X')).toHaveValue('10');
    expect(screen.queryByText('Nothing selected')).not.toBeInTheDocument();
  });

  it('renders emptyState when every selected id is dead', () => {
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['zombie', 'ghost'])}
        properties={properties}
        routing={routing}
        emptyState={<em>Nothing selected</em>}
      />,
    );
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
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
    label.focus();
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
    label.focus();
    fireEvent.blur(label);
    expect((scene.get(asNodeId('a')) as { data: Data }).data.label).toBe('hello');
    expect(scene.historyIndex()).toBe(before);
  });

  it('unknown custom leaf kind with no renderer shows a placeholder', () => {
    const withCustom: NodePropertiesEntry[] = [
      {
        name: 'rect',
        schema: {
          name: 'Properties',
          children: {
            'data.special': { kind: 'sparkle', name: 'Special', description: 's', default: null },
          },
        },
      },
    ];
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={withCustom}
        routing={routing}
      />,
    );
    expect(screen.getByText('(sparkle: no renderer)')).toBeInTheDocument();
  });
});
