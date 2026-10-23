import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from './testing/rectScene';

/**
 * A boolean leaf's `control` decides its chrome. `toggle` is what the kit's
 * own text schema asks for — three decoration flags reading as U / S / O on
 * one row rather than three switch rows.
 */
describe('SelectionPanel — boolean controls', () => {
  interface FlagData {
    kind: string;
    visible?: boolean;
    bold?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    overline?: boolean;
  }

  const flagRouting: NodeRoutingEntry[] = [
    { name: 'text', matches: (d) => (d as FlagData)?.kind === 'text' },
  ];

  const flagProperties: NodePropertiesEntry[] = [
    {
      name: 'text',
      schema: {
        name: 'Properties',
        members: {
          appearance: {
            name: 'Appearance',
            members: {
              'data.visible': { kind: 'boolean', name: 'Visible', description: 'v', default: false },
              'data.bold': {
                kind: 'boolean', name: 'Bold', description: 'b', default: false,
                control: 'toggle', short: ['B'],
              },
              'data.underline': {
                kind: 'boolean', name: 'Underline', description: 'u', default: false,
                control: 'toggle', short: ['U'],
                pair: { with: ['data.strikethrough', 'data.overline'], label: 'Decoration' },
              },
              'data.strikethrough': {
                kind: 'boolean', name: 'Strikethrough', description: 's', default: false,
                control: 'toggle', short: ['S'],
              },
              'data.overline': {
                kind: 'boolean', name: 'Overline', description: 'o', default: false,
                control: 'toggle', short: ['O'],
              },
            },
          },
        },
      },
    },
  ];

  function renderFlags(data: Omit<FlagData, 'kind'>, ids = ['t1']) {
    const scene = createScene<FlagData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    for (const id of ids) {
      scene.add({
        id: asNodeId(id),
        kind: 'mark',
        layer: 'default',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { kind: 'text', ...data },
      });
    }
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(ids)}
        properties={flagProperties}
        routing={flagRouting}
      />,
    );
    return scene;
  }

  it('renders a toggle-control boolean as a pressable segment, not a switch', () => {
    renderFlags({ underline: false });
    const seg = screen.getByRole('button', { name: 'Decoration Underline' });
    expect(seg).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('switch', { name: 'Decoration Underline' })).not.toBeInTheDocument();
  });

  it('lights the segment the node holds, and toggles it on click', () => {
    const scene = renderFlags({ underline: true, strikethrough: false });
    expect(screen.getByRole('button', { name: 'Decoration Underline' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Decoration Strikethrough' }));
    expect((scene.get(asNodeId('t1')) as { data: FlagData }).data.strikethrough).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Decoration Underline' }));
    expect((scene.get(asNodeId('t1')) as { data: FlagData }).data.underline).toBe(false);
  });

  it('puts the three paired decorations on one labeled row', () => {
    renderFlags({ underline: false });
    const row = screen.getByText('Decoration').parentElement!;
    expect(within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Decoration Underline',
      'Decoration Strikethrough',
      'Decoration Overline',
    ]);
  });

  it('still renders a switch for a boolean with no control', () => {
    renderFlags({ visible: true });
    expect(screen.getByRole('switch', { name: 'Visible' })).toBeInTheDocument();
  });

  it('renders the paired decorations as one segmented bar, not three', () => {
    renderFlags({ underline: false });
    const row = screen.getByText('Decoration').parentElement!;
    const bars = within(row).getAllByRole('group');
    expect(bars).toHaveLength(1);
    expect(within(bars[0]).getAllByRole('button')).toHaveLength(3);
    expect(bars[0]).toHaveAttribute('aria-label', 'Decoration');
  });

  it('writes only the flag that moved, leaving its neighbours alone', () => {
    const scene = renderFlags({ underline: true });
    fireEvent.click(screen.getByRole('button', { name: 'Decoration Strikethrough' }));
    const { data } = scene.get(asNodeId('t1')) as { data: FlagData };
    expect(data.strikethrough).toBe(true);
    expect(data.underline).toBe(true);
    expect('overline' in data).toBe(false);
  });

  // Unselected *is* the honest rendering of "not set" on a toggle button, and
  // the `Switch` path's dimming reads as disabled on one.
  it('does not dim an unset toggle, and still dims an unset switch', () => {
    renderFlags({});
    expect(screen.getByRole('button', { name: 'Bold' }).closest('[title="Not set"]')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Decoration Underline' }).closest('[title="Not set"]'),
    ).toBeNull();
    expect(screen.getByRole('switch', { name: 'Visible' }).closest('[title="Not set"]')).not.toBeNull();
  });

  it('leaves an unpaired toggle boolean on its own', () => {
    renderFlags({ bold: true });
    const seg = screen.getByRole('button', { name: 'Bold' });
    expect(seg).toHaveAttribute('aria-pressed', 'true');
    const label = screen.getAllByText('Bold').find((el) => !seg.contains(el))!;
    expect(within(label.parentElement!).getAllByRole('button')).toHaveLength(1);
  });
});

/**
 * The kit's own decorations are fields of the `data.style` object leaf, not
 * top-level paths — so the flag bar has to form inside an object leaf's rows
 * too, and each segment must still write only its own field of the object.
 */
describe('SelectionPanel — flags inside an object leaf', () => {
  interface StyleData { kind: string; style?: Record<string, unknown> }

  const styleRouting: NodeRoutingEntry[] = [
    { name: 'text', matches: (d) => (d as StyleData)?.kind === 'text' },
  ];

  const styleProperties: NodePropertiesEntry[] = [
    {
      name: 'text',
      schema: {
        name: 'Properties',
        members: {
          typography: {
            name: '',
            members: {
              'data.style': {
                kind: 'object', name: 'Style', description: 'st', default: {}, block: true,
                children: {
                  underline: {
                    kind: 'boolean', name: 'Underline', description: 'u', default: false,
                    control: 'toggle', short: ['U'],
                    pair: { with: ['data.style.strikethrough', 'data.style.overline'], label: 'Decoration' },
                  },
                  strikethrough: {
                    kind: 'boolean', name: 'Strikethrough', description: 's', default: false,
                    control: 'toggle', short: ['S'],
                  },
                  overline: {
                    kind: 'boolean', name: 'Overline', description: 'o', default: false,
                    control: 'toggle', short: ['O'],
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  function renderStyle(style: Record<string, unknown> | undefined) {
    const scene = createScene<StyleData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    scene.add({
      id: asNodeId('t1'),
      kind: 'mark',
      layer: 'default',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'text', ...(style ? { style } : {}) },
    });
    render(
      <SelectionPanel
        scene={scene}
        selection={selectionOf(['t1'])}
        properties={styleProperties}
        routing={styleRouting}
      />,
    );
    return scene;
  }

  it('renders the object leaf\'s paired flags as one bar named by the pair', () => {
    renderStyle({ underline: true });
    const row = screen.getByText('Decoration').parentElement!;
    const bars = within(row).getAllByRole('group');
    expect(bars).toHaveLength(1);
    expect(within(bars[0]).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Underline',
      'Strikethrough',
      'Overline',
    ]);
    expect(screen.getByRole('button', { name: 'Underline' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes only the moved field back into the style object', () => {
    const scene = renderStyle({ underline: true, fontSize: 18 });
    fireEvent.click(screen.getByRole('button', { name: 'Overline' }));
    const { data } = scene.get(asNodeId('t1')) as { data: StyleData };
    expect(data.style).toEqual({ underline: true, fontSize: 18, overline: true });
  });
});
