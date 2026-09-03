/**
 * The `font-family` arm. Its own file because the registry has to be stubbed:
 * `registerFont` needs a `fetch` + `createImageBitmap` pair to bake an atlas,
 * and none of that exercises what the panel decides. Only the three reads are
 * replaced — `@weasel-js/core` imports the rest of the module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  createScene,
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type SelectionApi,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';

const listFonts = vi.fn();
const listCanvasFonts = vi.fn();
const resolveFontVariant = vi.fn();

vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listFonts: () => listFonts(),
  listCanvasFonts: () => listCanvasFonts(),
  resolveFontVariant: (...args: unknown[]) => resolveFontVariant(...args),
}));

interface TextData {
  kind: string;
  style?: { fontFamily?: string; fontWeight?: number; fontStyle?: string };
}
type Layer = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const routing: NodeRoutingEntry[] = [
  { name: 'text', matches: (d) => (d as TextData)?.kind === 'text' },
];

const properties: NodePropertiesEntry[] = [
  {
    name: 'text',
    schema: {
      name: 'Properties',
      children: {
        text: {
          name: 'Text',
          children: {
            'data.style': {
              kind: 'object',
              name: 'Style',
              description: '',
              default: {},
              block: true,
              children: {
                fontFamily: {
                  kind: 'font-family',
                  name: 'Font',
                  description: 'Registered font family.',
                  default: 'sans-serif',
                },
              },
            },
          },
        },
      },
    },
  },
];

function renderPanel(rows: { id: string; style: TextData['style'] }[]) {
  const scene = createScene<TextData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  for (const r of rows) {
    scene.add({
      id: asNodeId(r.id),
      kind: 'leaf',
      layer: 'default',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'text', style: r.style },
    });
  }
  render(
    // No `renderers` prop: the kit's own schema declares this kind, so the
    // panel has to carry a control for it.
    <SelectionPanel
      scene={scene}
      selection={{ current: rows.map((r) => r.id) } as unknown as SelectionApi}
      properties={properties}
      routing={routing}
    />,
  );
  return scene;
}

beforeEach(() => {
  listFonts.mockReset();
  listFonts.mockReturnValue([
    { family: 'sans-serif', variants: [] },
    { family: 'serif', variants: [] },
  ]);
  listCanvasFonts.mockReset();
  listCanvasFonts.mockReturnValue([]);
  resolveFontVariant.mockReset();
  resolveFontVariant.mockReturnValue({ substituted: undefined });
});

describe('SelectionPanel — font-family leaf', () => {
  it('renders a real font control with no renderers supplied', () => {
    renderPanel([{ id: 't1', style: { fontFamily: 'serif' } }]);
    expect(screen.queryByText('(font-family: no renderer)')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('serif');
  });

  it('offers the registry and commits the chosen family', () => {
    const scene = renderPanel([{ id: 't1', style: { fontFamily: 'serif' } }]);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'sans-serif' }));
    expect((scene.get(asNodeId('t1')) as { data: TextData }).data.style?.fontFamily).toBe('sans-serif');
  });

  it('probes the substitution at the weight and style the node renders at', () => {
    renderPanel([{ id: 't1', style: { fontFamily: 'Inter', fontWeight: 700, fontStyle: 'italic' } }]);
    expect(resolveFontVariant).toHaveBeenCalledWith('Inter', 700, 'italic');
  });

  it('shows a Mixed placeholder when the selection disagrees', () => {
    renderPanel([
      { id: 't1', style: { fontFamily: 'serif' } },
      { id: 't2', style: { fontFamily: 'sans-serif' } },
    ]);
    expect(screen.getByRole('button')).toHaveTextContent('Mixed');
  });
});
