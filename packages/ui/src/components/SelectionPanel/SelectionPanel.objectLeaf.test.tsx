import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  dashForStrokeStyle,
  strokeDashStyleOf,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from './testing/rectScene';
import { renderWithIcons } from '../../testing/withIcons';

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
        members: {
          appearance: {
            name: 'Appearance',
            members: {
              'data.stroke': {
                kind: 'object',
                name: 'Stroke',
                description: 'Stroke paint and line geometry.',
                default: '#000000ff',
                block: true,
                fromScalar: (v: unknown) => ({
                  paint: { kind: 'solid', color: typeof v === 'string' ? v : '#000000ff' },
                }),
                children: {
                  paint: { kind: 'paint', name: 'Color', description: '', default: { kind: 'solid', color: '#000000ff' }, alpha: true },
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
      kind: 'mark',
      layer: 'default',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'path', stroke },
    });
    return scene;
  }

  function renderStroke(scene: ReturnType<typeof sceneWithStroke>) {
    return renderWithIcons(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['p'])}
        properties={strokeProperties}
        routing={strokeRouting}
      />,
    );
  }

  it('passes the selection key down to a field of an object leaf', () => {
    const seen: (string | undefined)[] = [];
    renderWithIcons(
      <SelectionPanel
        scene={sceneWithStroke({ paint: { color: '#00ff00ff' }, width: 4, cap: 'round' })}
        selection={selectionOf(['p'])}
        properties={strokeProperties}
        routing={strokeRouting}
        renderers={{ 'data.stroke.width': (ctx) => { seen.push(ctx.selectionKey); return <span>w</span>; } }}
      />,
    );
    expect(seen[0]).toBe('p');
  });

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
      paint: { color: '#123456' },
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
          members: {
            appearance: {
              name: 'Appearance',
              members: {
                'data.stroke': {
                  kind: 'object',
                  name: 'Stroke',
                  description: '',
                  default: { paint: { kind: 'solid', color: '#000000ff' }, width: 1 },
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
      renderWithIcons(
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
      renderToggle({ paint: { kind: 'solid', color: '#000000ff' }, width: 3 });
      expect(checkedLabels()).toEqual([]);
    });

    it('still lights the segment the node does hold', () => {
      renderToggle({ paint: { kind: 'solid', color: '#000000ff' }, width: 3, cap: 'round' });
      expect(checkedLabels()).toEqual(['Round']);
    });

    it('leaves a select unselected rather than showing its default', () => {
      renderWithIcons(
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
      renderWithIcons(
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
          members: {
            appearance: {
              name: 'Appearance',
              members: {
                'data.stroke': {
                  kind: 'object',
                  name: 'Stroke',
                  description: '',
                  default: { paint: { kind: 'solid', color: '#000000ff' }, width: 1 },
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
      renderWithIcons(
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
      paint: { kind: 'solid', color: '#000000ff' }, width, ...(dash ? { dash } : {}),
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
        paint: { kind: 'solid', color: '#000000ff' }, width: 4, dash: [12, 8],
      });
    });

    it('removes the field rather than storing an empty pattern for solid', () => {
      const scene = renderDash(strokeOfWidth(4, [12, 8]));
      fireEvent.click(screen.getByLabelText('Solid'));
      const stroke = scene.get(asNodeId('p'))?.data.stroke as Record<string, unknown>;
      expect(stroke).toEqual({ paint: { kind: 'solid', color: '#000000ff' }, width: 4 });
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

    // The two strokes differ, so there is no one object to read the style
    // against — each array has to be read against its own node's width.
    describe('across strokes of different widths', () => {
      const renderPair = () => {
        const scene = sceneWithStroke(strokeOfWidth(2, dashForStrokeStyle('dashed', 2)));
        scene.add({
          id: asNodeId('q'),
          kind: 'mark',
          layer: 'default',
          pose: { x: 0, y: 0, width: 10, height: 10 },
          data: { kind: 'path', stroke: strokeOfWidth(4, dashForStrokeStyle('dashed', 4)) },
        });
        renderWithIcons(
          <SelectionPanel
            scene={scene}
            selection={selectionOf(['p', 'q'])}
            properties={dashProperties}
            routing={strokeRouting}
          />,
        );
        return scene;
      };

      it('reads the style both hold', () => {
        renderPair();
        expect(lit()).toEqual(['Dashed']);
      });

      it('writes each stroke an array scaled by its own width', () => {
        const scene = renderPair();
        fireEvent.click(screen.getByLabelText('Dotted'));
        expect((scene.get(asNodeId('p'))?.data.stroke as Record<string, unknown>).dash)
          .toEqual(dashForStrokeStyle('dotted', 2));
        expect((scene.get(asNodeId('q'))?.data.stroke as Record<string, unknown>).dash)
          .toEqual(dashForStrokeStyle('dotted', 4));
      });
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
        members: {
          appearance: {
            name: 'Appearance',
            members: {
              'data.stroke': {
                kind: 'object',
                name: 'Stroke',
                description: '',
                default: { paint: { kind: 'solid', color: '#000000ff' }, width: 1 },
                block: true,
                children: {
                  paint: { kind: 'paint', name: 'Color', description: '', default: { kind: 'solid', color: '#000000ff' }, alpha: true },
                  width: { kind: 'number', name: 'Width', description: '', default: 1, min: 0, step: 0.5 },
                  cap: { kind: 'enum', name: 'Cap', description: '', default: 'butt', options: [{ value: 'butt', label: 'Butt' }, { value: 'round', label: 'Round' }] },
                },
              },
            },
          },
        },
      },
    }] as unknown as NodePropertiesEntry[];

    const renderReal = (scene: ReturnType<typeof sceneWithStroke>) => renderWithIcons(
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
        paint: { kind: 'solid', color: '#000000ff' },
        width: 3,
      });
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
      paint: { kind: 'solid', color: '#ff0000ff' },
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
          members: {
            appearance: {
              name: 'Appearance',
              members: {
                'data.stroke': {
                  kind: 'object',
                  name: 'Stroke',
                  description: '',
                  default: {},
                  block: true,
                  children: {
                    geometry: {
                      name: 'Geometry',
                      members: {
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
    renderWithIcons(
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

  it('edits a gradient stroke paint as a gradient', () => {
    // The stroke's paint field is the same `paint` leaf the fill uses, so it
    // gets the whole editor rather than a chip that can only degrade it.
    const { container } = renderStroke(sceneWithStroke({
      paint: {
        kind: 'linear-gradient',
        from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
        stops: [{ offset: 0, color: '#000000ff' }, { offset: 1, color: '#ffffffff' }],
      },
      width: 4,
    }));
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();
    expect(screen.getByLabelText('Stop 1')).toBeInTheDocument();
    expect(container.querySelector('[data-mixed]')).toBeNull();
  });
});
