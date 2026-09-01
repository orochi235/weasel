import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  dashForStrokeStyle,
  rotationDegreesUnit,
  strokeDashStyleOf,
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

  it('shows a gradient fill as a gradient, not as the indeterminate chip', () => {
    // The checkerboard used to mean both "mixed selection" and "structurally
    // not a solid". Now that the leaf previews a gradient as a gradient it
    // means mixed and nothing else.
    const { container } = renderPaint({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#000000ff' }, { offset: 1, color: '#ffffffff' }],
    });
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();
    expect(screen.getByLabelText('Stop 1 at 0%')).toBeInTheDocument();
    expect(container.querySelector('[data-mixed]')).toBeNull();
  });

  it('still shows the indeterminate chip for a genuinely mixed selection', () => {
    const scene = createScene<PaintData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    for (const [id, color] of [['a', '#ff0000ff'], ['b', '#00ff00ff']] as const) {
      scene.add({
        id: asNodeId(id),
        kind: 'leaf',
        layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { kind: 'text', style: { fill: { fill: 'solid', color } } },
      });
    }
    const { container } = render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['a', 'b'])}
        properties={paintProperties}
        routing={paintRouting}
      />,
    );
    expect(container.querySelector('[data-mixed]')).not.toBeNull();
  });

  it('writes a whole solid fill, never a color grafted onto a gradient', () => {
    const scene = sceneWithFill({
      fill: 'radial-gradient',
      center: { x: 0, y: 0 },
      radius: 1,
      stops: [{ offset: 0, color: '#000000ff' }],
    });
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['t'])}
        properties={paintProperties}
        routing={paintRouting}
      />,
    );
    // Switching kind is now how a gradient becomes a solid, and it must
    // replace the union member rather than graft a `color` onto it. The
    // registry seeds an untagged solid, which is the member's own shape —
    // what must not survive is any of the gradient.
    fireEvent.click(screen.getByRole('radio', { name: 'Solid' }));
    expect(scene.get(asNodeId('t'))?.data.style?.fill).toEqual({ color: '#000000ff' });

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
 * An object leaf holds one value with its fields hanging off it. Sibling
 * leaves addressing into the same object would each write one field of a value
 * they can only half see — and would corrupt it outright while it is still
 * held in a scalar form.
 */
describe('SelectionPanel — object leaf', () => {
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
                kind: 'object',
                name: 'Stroke',
                description: 'Stroke paint and line geometry.',
                default: '#000000ff',
                block: true,
                fromScalar: (v: unknown) => ({
                  paint: { fill: 'solid', color: typeof v === 'string' ? v : '#000000ff' },
                }),
                children: {
                  paint: { kind: 'paint', name: 'Color', description: '', default: { fill: 'solid', color: '#000000ff' }, alpha: true },
                  width: { kind: 'number', name: 'Width', description: '', default: 1, min: 0, step: 0.5 },
                  cap: { kind: 'enum', name: 'Cap', description: '', default: 'butt', options: [{ value: 'butt', label: 'Butt' }, { value: 'round', label: 'Round' }] },
                },
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

  it('renders a row per field, labeled by the child leaves', () => {
    renderStroke(sceneWithStroke({ paint: { color: '#00ff00ff' }, width: 4, cap: 'round' }));
    expect(screen.getByLabelText('Color')).toHaveValue('#00ff00');
    expect(screen.getByLabelText('Width')).toHaveValue('4');
    expect(screen.getByLabelText('Cap')).toBeInTheDocument();
  });

  it('commits the whole object when one field is edited', () => {
    const scene = sceneWithStroke({ paint: { color: '#000000ff' }, width: 12, cap: 'round' });
    renderStroke(scene);
    const input = screen.getByLabelText('Color');
    fireEvent.input(input, { target: { value: '#123456' } });
    fireEvent.blur(input);
    expect(scene.get(asNodeId('p'))?.data.stroke).toEqual({
      paint: { fill: 'solid', color: '#123456ff' },
      width: 12,
      cap: 'round',
    });
  });

  // A field the node does not hold must not be shown as though it did: the
  // control would claim a value, and the next edit would write that invention
  // back. `data.stroke` absent leaves every one of its fields with nothing.
  describe('unset fields', () => {
    const toggleProperties: NodePropertiesEntry[] = [
      {
        name: 'path',
        schema: {
          name: 'Properties',
          children: {
            appearance: {
              name: 'Appearance',
              children: {
                'data.stroke': {
                  kind: 'object',
                  name: 'Stroke',
                  description: '',
                  default: { paint: { fill: 'solid', color: '#000000ff' }, width: 1 },
                  children: {
                    cap: {
                      kind: 'enum', name: 'Cap', description: '', default: 'butt', control: 'toggle',
                      options: [{ value: 'butt', label: 'Butt' }, { value: 'round', label: 'Round' }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const renderToggle = (stroke: unknown) =>
      render(
        <SelectionPanel
          scene={sceneWithStroke(stroke)}
          selection={selectionOf(['p'])}
          properties={toggleProperties}
          routing={strokeRouting}
        />,
      );

    const checkedLabels = () =>
      screen.getAllByRole('radio')
        .filter((b) => b.getAttribute('aria-checked') === 'true')
        .map((b) => b.getAttribute('aria-label'));

    it('lights no segment when the object is absent', () => {
      renderToggle(undefined);
      expect(screen.getAllByRole('radio')).toHaveLength(2);
      expect(checkedLabels()).toEqual([]);
    });

    it('lights no segment when the object omits that field', () => {
      // The stroke exists, so the leaf is not absent — but `cap` within it is.
      renderToggle({ paint: { fill: 'solid', color: '#000000ff' }, width: 3 });
      expect(checkedLabels()).toEqual([]);
    });

    it('still lights the segment the node does hold', () => {
      renderToggle({ paint: { fill: 'solid', color: '#000000ff' }, width: 3, cap: 'round' });
      expect(checkedLabels()).toEqual(['Round']);
    });

    it('leaves a select unselected rather than showing its default', () => {
      render(
        <SelectionPanel
          scene={sceneWithStroke(undefined)}
          selection={selectionOf(['p'])}
          properties={strokeProperties}
          routing={strokeRouting}
        />,
      );
      expect(screen.getByLabelText('Cap')).toHaveTextContent('—');
      expect(screen.getByLabelText('Cap')).not.toHaveTextContent('Butt');
    });

    it('leaves a number blank rather than showing its default', () => {
      render(
        <SelectionPanel
          scene={sceneWithStroke(undefined)}
          selection={selectionOf(['p'])}
          properties={strokeProperties}
          routing={strokeRouting}
        />,
      );
      expect(screen.getByLabelText('Width')).toHaveValue('');
    });
  });

  /**
   * `Stroke.dash` stores lengths; the thing a person chooses is a style. The
   * leaf's `encoding` is what bridges the two, and the presets are multiples
   * of the sibling `width`, so both directions read it.
   */
  describe('an enum leaf whose stored value is not the option string', () => {
    const dashProperties: NodePropertiesEntry[] = [
      {
        name: 'path',
        schema: {
          name: 'Properties',
          children: {
            appearance: {
              name: 'Appearance',
              children: {
                'data.stroke': {
                  kind: 'object',
                  name: 'Stroke',
                  description: '',
                  default: { paint: { fill: 'solid', color: '#000000ff' }, width: 1 },
                  children: {
                    dash: {
                      kind: 'enum', name: 'Style', description: '', default: 'solid', control: 'toggle',
                      encoding: {
                        read: (dash, stroke) =>
                          stroke === undefined
                            ? undefined
                            : strokeDashStyleOf(Array.isArray(dash) ? (dash as number[]) : undefined, stroke.width as number),
                        write: (style, stroke) =>
                          style === 'dashed' || style === 'dotted'
                            ? dashForStrokeStyle(style, stroke?.width as number)
                            : undefined,
                      },
                      options: [
                        { value: 'solid', label: 'Solid' },
                        { value: 'dashed', label: 'Dashed' },
                        { value: 'dotted', label: 'Dotted' },
                        { value: 'custom', label: 'Custom', disabled: true },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];

    const renderDash = (stroke: unknown) => {
      const scene = sceneWithStroke(stroke);
      render(
        <SelectionPanel
          scene={scene}
          selection={selectionOf(['p'])}
          properties={dashProperties}
          routing={strokeRouting}
        />,
      );
      return scene;
    };

    const lit = () =>
      screen.getAllByRole('radio')
        .filter((b) => b.getAttribute('aria-checked') === 'true')
        .map((b) => b.getAttribute('aria-label'));

    const strokeOfWidth = (width: number, dash?: number[]) => ({
      paint: { fill: 'solid', color: '#000000ff' }, width, ...(dash ? { dash } : {}),
    });

    it('reads an absent dash as solid', () => {
      renderDash(strokeOfWidth(4));
      expect(lit()).toEqual(['Solid']);
    });

    it('reads the stored array against the stroke width', () => {
      renderDash(strokeOfWidth(4, [12, 8]));
      expect(lit()).toEqual(['Dashed']);
    });

    it('reads the same array as custom at another width', () => {
      renderDash(strokeOfWidth(1, [12, 8]));
      expect(lit()).toEqual(['Custom']);
    });

    it('writes an array scaled by the width', () => {
      const scene = renderDash(strokeOfWidth(4));
      fireEvent.click(screen.getByLabelText('Dashed'));
      expect(scene.get(asNodeId('p'))?.data.stroke).toEqual({
        paint: { fill: 'solid', color: '#000000ff' }, width: 4, dash: [12, 8],
      });
    });

    it('removes the field rather than storing an empty pattern for solid', () => {
      const scene = renderDash(strokeOfWidth(4, [12, 8]));
      fireEvent.click(screen.getByLabelText('Solid'));
      const stroke = scene.get(asNodeId('p'))?.data.stroke as Record<string, unknown>;
      expect(stroke).toEqual({ paint: { fill: 'solid', color: '#000000ff' }, width: 4 });
      expect('dash' in stroke).toBe(false);
    });

    // `custom` reports an imported array honestly; there is no array it maps
    // back to, so the segment refuses the click rather than inventing one.
    it('will not author custom', () => {
      const scene = renderDash(strokeOfWidth(1, [9, 1, 2, 1]));
      expect(lit()).toEqual(['Custom']);
      expect(screen.getByLabelText('Custom')).toBeDisabled();
      // Off the imported array, the segment is still no way back to one.
      fireEvent.click(screen.getByLabelText('Solid'));
      fireEvent.click(screen.getByLabelText('Custom'));
      expect((scene.get(asNodeId('p'))?.data.stroke as Record<string, unknown>).dash).toBeUndefined();
    });

    it('lights nothing when the node holds no stroke at all', () => {
      renderDash(undefined);
      expect(lit()).toEqual([]);
    });
  });

  /**
   * The real kit schema (`defaultNodeProperties`) declares no `fromScalar`
   * and an object `default`, which the fixture above does not model — so the
   * panel's own suite could not see this. Editing one field on a node with no
   * stroke used to commit that field alone: a `Stroke` with no `paint`, which
   * the type forbids, the painter threw on, and which took the whole frame
   * with it — the document vanished until an unrelated redraw.
   */
  describe('a node holding no object at all', () => {
    // As the kit declares it: no `fromScalar`, and a complete object default.
    const realShape: NodePropertiesEntry[] = [{
      name: 'path',
      schema: {
        name: 'Properties',
        children: {
          appearance: {
            name: 'Appearance',
            children: {
              'data.stroke': {
                kind: 'object',
                name: 'Stroke',
                description: '',
                default: { paint: { fill: 'solid', color: '#000000ff' }, width: 1 },
                block: true,
                children: {
                  paint: { kind: 'paint', name: 'Color', description: '', default: { fill: 'solid', color: '#000000ff' }, alpha: true },
                  width: { kind: 'number', name: 'Width', description: '', default: 1, min: 0, step: 0.5 },
                  cap: { kind: 'enum', name: 'Cap', description: '', default: 'butt', options: [{ value: 'butt', label: 'Butt' }, { value: 'round', label: 'Round' }] },
                },
              },
            },
          },
        },
      },
    }] as unknown as NodePropertiesEntry[];

    const renderReal = (scene: ReturnType<typeof sceneWithStroke>) => render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['p'])}
        properties={realShape}
        routing={strokeRouting}
      />,
    );

    it('materializes the whole default when a field is written', () => {
      const scene = sceneWithStroke(undefined);
      renderReal(scene);
      const width = screen.getByLabelText('Width');
      fireEvent.change(width, { target: { value: '3' } });
      fireEvent.blur(width);
      expect(scene.get(asNodeId('p'))?.data.stroke).toEqual({
        paint: { fill: 'solid', color: '#000000ff' },
        width: 3,
      });
    });

    it('never commits a stroke without a paint', () => {
      const scene = sceneWithStroke(undefined);
      renderReal(scene);
      fireEvent.click(screen.getByLabelText('Cap'));
      const width = screen.getByLabelText('Width');
      fireEvent.change(width, { target: { value: '5' } });
      fireEvent.blur(width);
      const stroke = scene.get(asNodeId('p'))?.data.stroke as Record<string, unknown>;
      expect(stroke.paint).toBeDefined();
    });
  });

  it('lifts a scalar value through `fromScalar` before applying a field', () => {
    // The node holds a bare color string; editing width has to produce a whole
    // stroke rather than writing `width` into a string.
    const scene = sceneWithStroke('#ff0000ff');
    renderStroke(scene);
    const width = screen.getByLabelText('Width');
    fireEvent.change(width, { target: { value: '7' } });
    fireEvent.blur(width);
    expect(scene.get(asNodeId('p'))?.data.stroke).toEqual({
      paint: { fill: 'solid', color: '#ff0000ff' },
      width: 7,
    });
  });

  it('organises fields under a group heading without putting it in the path', () => {
    // The heading is presentation; `width` is still a field of the stroke,
    // so the commit is flat.
    const grouped: NodePropertiesEntry[] = [
      {
        name: 'path',
        schema: {
          name: 'Properties',
          children: {
            appearance: {
              name: 'Appearance',
              children: {
                'data.stroke': {
                  kind: 'object',
                  name: 'Stroke',
                  description: '',
                  default: {},
                  block: true,
                  children: {
                    geometry: {
                      name: 'Geometry',
                      children: {
                        width: { kind: 'number', name: 'Width', description: '', default: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];
    const scene = sceneWithStroke({ paint: { color: '#000000ff' }, width: 3 });
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['p'])}
        properties={grouped}
        routing={strokeRouting}
      />,
    );
    expect(screen.getByText('Geometry')).toBeInTheDocument();
    const width = screen.getByLabelText('Width');
    fireEvent.change(width, { target: { value: '9' } });
    fireEvent.blur(width);
    expect(scene.get(asNodeId('p'))?.data.stroke).toEqual({
      paint: { color: '#000000ff' },
      width: 9,
    });
  });

  it('offers no None on the stroke paint, which cannot hold one', () => {
    // `Stroke.paint` is required. A nested paint writes one field of its
    // parent, so offering None here would produce `{ ...stroke, paint: null }`
    // — an invalid Stroke. Dropping the stroke is the parent's edit to make.
    renderStroke(sceneWithStroke({ paint: { fill: 'solid', color: '#00ff00ff' }, width: 4 }));
    expect(screen.queryByRole('radio', { name: 'None' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Solid' })).toBeInTheDocument();
  });

  it('edits a gradient stroke paint as a gradient', () => {
    // The stroke's paint field is the same `paint` leaf the fill uses, so it
    // gets the whole editor rather than a chip that can only degrade it.
    const { container } = renderStroke(sceneWithStroke({
      paint: {
        fill: 'linear-gradient',
        from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
        stops: [{ offset: 0, color: '#000000ff' }, { offset: 1, color: '#ffffffff' }],
      },
      width: 4,
    }));
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();
    expect(screen.getByLabelText('Stop 1 at 0%')).toBeInTheDocument();
    expect(container.querySelector('[data-mixed]')).toBeNull();
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
