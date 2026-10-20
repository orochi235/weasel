import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagramView, type DiagramViewApi } from './DiagramView';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import { createSpecLabelPlacer } from './labels/specLabels';
import { diagramLabelOf } from './labelTrait';

afterEach(() => { cleanup(); });

const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** `a -> b` runs flat, its label above it at the middle, under `cover`. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['a'], at: { x: 0, y: 100 }, width: 100, height: 60 },
    { id: 'b', lines: ['b'], at: { x: 400, y: 100 }, width: 100, height: 60 },
    { id: 'cover', lines: [], at: { x: 225, y: 80 }, width: 50, height: 36 },
  ],
  edges: [{ from: 'a', to: 'b', fromPort: 'e', toPort: 'w', label: 'note' }],
};
const LABEL = `${edgeIdOf(DATA.edges[0]!)}/label`;

type Rect = { x: number; y: number; width: number; height: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function mount(labels?: 'dodge') {
  const api = createRef<DiagramViewApi>();
  render(
    <DiagramView
      ref={api} specs={diagramScene(DATA, { layout: 'none' })} labels={labels}
      width={600} height={300} view={IDENTITY} onViewChange={() => {}}
    />,
  );
  return api;
}

describe('DiagramView labels="dodge"', () => {
  it('draws a covered label clear of the shape covering it', async () => {
    const api = mount('dodge');
    await act(async () => {});
    expect(overlaps(api.current!.rectOf(LABEL)!, api.current!.rectOf('cover')!)).toBe(false);
  });

  it('leaves the label where its preference puts it without the prop', async () => {
    const api = mount();
    await act(async () => {});
    expect(overlaps(api.current!.rectOf(LABEL)!, api.current!.rectOf('cover')!)).toBe(true);
  });
});

describe('createSpecLabelPlacer', () => {
  it('places each covered label spec off its preference, and leaves the rest', () => {
    const specs = createSpecLabelPlacer()(diagramScene(DATA, { layout: 'none' }));
    expect(diagramLabelOf(specs.find((s) => s.id === LABEL)!)!.placed).toBeDefined();
    const clear = createSpecLabelPlacer()(diagramScene({ ...DATA, nodes: DATA.nodes.slice(0, 2) }, { layout: 'none' }));
    expect(diagramLabelOf(clear.find((s) => s.id === LABEL)!)!.placed).toBeUndefined();
  });

  it('answers the same specs for the same input', () => {
    const place = createSpecLabelPlacer();
    const first = place(diagramScene(DATA, { layout: 'none' }));
    const second = place(diagramScene(DATA, { layout: 'none' }));
    expect(diagramLabelOf(second.find((s) => s.id === LABEL)!)).toEqual(diagramLabelOf(first.find((s) => s.id === LABEL)!));
  });
});
