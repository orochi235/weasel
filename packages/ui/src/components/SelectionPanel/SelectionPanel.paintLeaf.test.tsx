import { describe, it, expect } from 'vitest';
import { act, screen, fireEvent } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from './testing/rectScene';
import { renderWithIcons } from '../../testing/withIcons';

/**
 * The `paint` leaf addresses a whole `Paint`. The `color` leaf can't:
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
        members: {
          appearance: {
            name: 'Appearance',
            members: {
              'data.style.fill': {
                kind: 'paint',
                name: 'Color',
                description: 'Text color.',
                default: { kind: 'solid', color: '#000000ff' },
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
      kind: 'mark',
      layer: 'default',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'text', style: { fill } },
    });
    return scene;
  }

  function renderPaint(fill: unknown) {
    return renderWithIcons(
      <SelectionPanel
        scene={sceneWithFill(fill)}
        selection={selectionOf(['t'])}
        properties={paintProperties}
        routing={paintRouting}
      />,
    );
  }

  it('shows a solid fill as its color', () => {
    renderPaint({ kind: 'solid', color: '#ff0000ff' });
    expect(screen.getByLabelText('Color')).toHaveValue('#ff0000');
  });

  it('shows an untagged solid fill as its color', () => {
    // `fill` is optional on the solid member of the union.
    renderPaint({ color: '#00ff00ff' });
    expect(screen.getByLabelText('Color')).toHaveValue('#00ff00');
  });

  it("tracks a paint's opacity written in a batch while the panel is mounted", () => {
    // apps/draw's opacity scrub writes exactly this shape: `opacity` on the
    // solid paint, through `scene.update` inside `scene.batch`.
    const scene = sceneWithFill({ color: '#336699' });
    renderWithIcons(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['t'])}
        properties={paintProperties}
        routing={paintRouting}
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Color opacity' });
    expect(slider).toHaveValue('100');
    act(() => {
      scene.batch('Adjust opacity', () => {
        scene.update(asNodeId('t'), { data: { kind: 'text', style: { fill: { color: '#336699', opacity: 0.35 } } } });
      });
    });
    expect(slider).toHaveValue('35');
  });

  it('shows a gradient fill as a gradient, not as the indeterminate chip', () => {
    // The checkerboard used to mean both "mixed selection" and "structurally
    // not a solid". Now that the leaf previews a gradient as a gradient it
    // means mixed and nothing else.
    const { container } = renderPaint({
      kind: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#000000ff' }, { offset: 1, color: '#ffffffff' }],
    });
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();
    expect(screen.getByLabelText('Stop 1')).toBeInTheDocument();
    expect(container.querySelector('[data-mixed]')).toBeNull();
  });

  it('still shows the indeterminate chip for a genuinely mixed selection', () => {
    const scene = createScene<PaintData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    for (const [id, color] of [['a', '#ff0000ff'], ['b', '#00ff00ff']] as const) {
      scene.add({
        id: asNodeId(id),
        kind: 'mark',
        layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { kind: 'text', style: { fill: { kind: 'solid', color } } },
      });
    }
    const { container } = renderWithIcons(
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
      kind: 'radial-gradient',
      center: { x: 0, y: 0 },
      radius: 1,
      stops: [{ offset: 0, color: '#000000ff' }],
    });
    renderWithIcons(
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
    expect(scene.get(asNodeId('t'))?.data.style?.fill).toEqual({ color: '#123456' });
  });
});
