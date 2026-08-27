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

  it('null-returning renderer collapses chrome: lone rows drop their section title, pair rows survive', () => {
    // Appearance holds a single-leaf row (Fill) — nulling it must remove
    // the row AND the now-empty section title. Layout's Position pair
    // loses only X; the row survives with Y.
    const props: NodePropertiesEntry[] = [
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
              },
            },
            appearance: {
              name: 'Appearance',
              children: {
                'data.fill': { kind: 'color', name: 'Fill', description: 'f', default: '#000000ff', alpha: true },
              },
            },
          },
        },
      },
    ];
    render(
      <SelectionPanel
        scene={makeScene()}
        selection={selectionOf(['a'])}
        properties={props}
        routing={routing}
        renderers={{ 'data.fill': () => null, 'pose.x': () => null }}
      />,
    );
    // Single-leaf row: row label and section title both gone.
    expect(screen.queryByText('Fill')).not.toBeInTheDocument();
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
    // Pair row: X collapsed, row remains with Y.
    expect(screen.queryByLabelText('Position X')).not.toBeInTheDocument();
    expect(screen.getByText('Position')).toBeInTheDocument();
    expect(screen.getByLabelText('Position Y')).toHaveValue('20');
  });
});

/**
 * The `paint` leaf addresses a whole `FillStyle`. The `color` leaf can't:
 * pointed at `…fill.color` it reads `undefined` off a gradient, shows its
 * own default, and writes a hybrid `{ fill: 'gradient', stops, color }` that
 * the renderer's structural `'color' in paint` checks paint flat solid.
 */
describe('SelectionPanel — paint leaf', () => {
  interface PaintData { kind: string; style?: { fill?: unknown } }

  const paintRouting: NodeRoutingEntry[] = [
    { name: 'text', matches: (d) => (d as PaintData)?.kind === 'text' },
  ];
  const paintProperties: NodePropertiesEntry[] = [
    {
      name: 'text',
      schema: {
        name: 'Properties',
        children: {
          appearance: {
            name: 'Appearance',
            children: {
              'data.style.fill': {
                kind: 'paint',
                name: 'Color',
                description: 'Text color.',
                default: { fill: 'solid', color: '#000000ff' },
                alpha: true,
              },
            },
          },
        },
      },
    },
  ];

  function sceneWithFill(fill: unknown) {
    const scene = createScene<PaintData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    scene.add({
      id: asNodeId('t'),
      kind: 'leaf',
      layer: 'default',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'text', style: { fill } },
    });
    return scene;
  }

  function renderPaint(fill: unknown) {
    return render(
      <SelectionPanel
        scene={sceneWithFill(fill)}
        selection={selectionOf(['t'])}
        properties={paintProperties}
        routing={paintRouting}
      />,
    );
  }

  it('shows a solid fill as its color', () => {
    renderPaint({ fill: 'solid', color: '#ff0000ff' });
    expect(screen.getByLabelText('Color')).toHaveValue('#ff0000');
  });

  it('shows an untagged solid fill as its color', () => {
    // `fill` is optional on the solid member of the union.
    renderPaint({ color: '#00ff00ff' });
    expect(screen.getByLabelText('Color')).toHaveValue('#00ff00');
  });

  it('shows a gradient fill as indeterminate rather than as a color', () => {
    const { container } = renderPaint({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
    });
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('writes a whole solid fill, never a color grafted onto a gradient', () => {
    const scene = sceneWithFill({
      fill: 'radial-gradient',
      center: { x: 0, y: 0 },
      radius: 1,
      stops: [{ offset: 0, color: '#000' }],
    });
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['t'])}
        properties={paintProperties}
        routing={paintRouting}
      />,
    );
    const input = screen.getByLabelText('Color');
    fireEvent.input(input, { target: { value: '#123456' } });
    fireEvent.blur(input);
    expect(scene.get(asNodeId('t'))?.data.style?.fill).toEqual({
      fill: 'solid',
      color: '#123456ff',
    });
  });
});

/**
 * The `stroke` leaf addresses `string | Stroke`. A `color` leaf pointed at the
 * same path reads `undefined` off the object form, shows its own default, and
 * writes a bare hex back over the stroke's width, cap, join and dash.
 */
describe('SelectionPanel — stroke leaf', () => {
  interface StrokeData { kind: string; stroke?: unknown }

  const strokeRouting: NodeRoutingEntry[] = [
    { name: 'path', matches: (d) => (d as StrokeData)?.kind === 'path' },
  ];
  const strokeProperties: NodePropertiesEntry[] = [
    {
      name: 'path',
      schema: {
        name: 'Properties',
        children: {
          appearance: {
            name: 'Appearance',
            children: {
              'data.stroke': {
                kind: 'stroke',
                name: 'Stroke',
                description: 'Stroke color, or a whole stroke.',
                default: '#000000ff',
                alpha: true,
              },
            },
          },
        },
      },
    },
  ];

  function sceneWithStroke(stroke: unknown) {
    const scene = createScene<StrokeData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    scene.add({
      id: asNodeId('p'),
      kind: 'leaf',
      layer: 'default',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'path', stroke },
    });
    return scene;
  }

  function renderStroke(scene: ReturnType<typeof sceneWithStroke>) {
    return render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['p'])}
        properties={strokeProperties}
        routing={strokeRouting}
      />,
    );
  }

  it('shows a color-string stroke as its color', () => {
    renderStroke(sceneWithStroke('#ff0000ff'));
    expect(screen.getByLabelText('Stroke')).toHaveValue('#ff0000');
  });

  it('shows a solid-paint Stroke as its color', () => {
    renderStroke(sceneWithStroke({ paint: { color: '#00ff00ff' }, width: 4 }));
    expect(screen.getByLabelText('Stroke')).toHaveValue('#00ff00');
  });

  it('shows a gradient stroke as indeterminate rather than as a color', () => {
    const { container } = renderStroke(sceneWithStroke({
      paint: {
        fill: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      },
      width: 4,
    }));
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('keeps width, cap and dash when a color is picked', () => {
    const scene = sceneWithStroke({
      paint: { color: '#000000ff' }, width: 12, cap: 'round', dash: [8, 4],
    });
    renderStroke(scene);
    const input = screen.getByLabelText('Stroke');
    fireEvent.input(input, { target: { value: '#123456' } });
    fireEvent.blur(input);
    expect(scene.get(asNodeId('p'))?.data.stroke).toEqual({
      paint: { fill: 'solid', color: '#123456ff' },
      width: 12,
      cap: 'round',
      dash: [8, 4],
    });
  });

  it('leaves a color-string stroke a string', () => {
    const scene = sceneWithStroke('#ff0000ff');
    renderStroke(scene);
    const input = screen.getByLabelText('Stroke');
    fireEvent.input(input, { target: { value: '#123456' } });
    fireEvent.blur(input);
    expect(scene.get(asNodeId('p'))?.data.stroke).toBe('#123456ff');
  });
});

/**
 * A leaf is handed one field, so a control whose subject spans several — a
 * font picker naming the variant that will actually paint — could not see the
 * rest of the node.
 */
describe('SelectionPanel — valueAt', () => {
  interface SpanData { kind: string; a?: unknown; b?: unknown }

  const spanRouting: NodeRoutingEntry[] = [
    { name: 'span', matches: (d) => (d as SpanData)?.kind === 'span' },
  ];
  const spanProperties: NodePropertiesEntry[] = [
    {
      name: 'span',
      schema: {
        name: 'Properties',
        children: {
          group: {
            name: 'Group',
            children: {
              'data.a': { kind: 'string', name: 'A', description: '', default: '' },
              'data.b': { kind: 'string', name: 'B', description: '', default: '' },
            },
          },
        },
      },
    },
  ];

  function sceneOf(rows: { id: string; a: unknown; b: unknown }[]) {
    const scene = createScene<SpanData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    for (const r of rows) {
      scene.add({
        id: asNodeId(r.id),
        kind: 'leaf',
        layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { kind: 'span', a: r.a, b: r.b },
      });
    }
    return scene;
  }

  function renderSpan(rows: { id: string; a: unknown; b: unknown }[], seen: unknown[]) {
    render(
      <SelectionPanel
        scene={sceneOf(rows)}
        selection={selectionOf(rows.map((r) => r.id))}
        properties={spanProperties}
        routing={spanRouting}
        renderers={{
          'data.a': (ctx) => {
            seen.push(ctx.valueAt('data.b'));
            return <span>a</span>;
          },
        }}
      />,
    );
  }

  it("hands a renderer another leaf's aggregated value", () => {
    const seen: unknown[] = [];
    renderSpan([{ id: 'n1', a: 'x', b: 700 }], seen);
    expect(seen[0]).toEqual({ value: 700, mixed: false });
  });

  it('reports a disagreeing selection as mixed, not as one node\'s value', () => {
    const seen: unknown[] = [];
    renderSpan([{ id: 'n1', a: 'x', b: 700 }, { id: 'n2', a: 'x', b: 400 }], seen);
    expect(seen[0]).toEqual({ value: undefined, mixed: true });
  });

  it('reports a path no node carries as an undefined value, not as mixed', () => {
    const seen: unknown[] = [];
    renderSpan([{ id: 'n1', a: 'x', b: undefined }], seen);
    expect(seen[0]).toEqual({ value: undefined, mixed: false });
  });
});
