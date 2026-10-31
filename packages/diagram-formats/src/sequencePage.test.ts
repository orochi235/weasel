import { PAGES_DOC_KEY, createScene, placedPagesOf, type RectPose, type SerializedDoc } from '@weasel-js/core';
import { DIAGRAM_THEMES, sequenceRootOf, withDiagramRegistry, type SequenceData } from '@weasel-js/diagram';
import { describe, expect, it } from 'vitest';
import { formatTakes, type DiagramDocument, type SequencePage } from './document';
import { DIAGRAM_DOT } from './dot/format';
import { documentFromScene } from './fromScene';
import { DIAGRAM_JSON } from './jsonFormat';
import { scenePageKinds } from './pageKinds';
import { exportPageSvg } from './pageSvg';
import { sequenceRootIdOf } from './sequencePage';
import { MEASURE } from './testing/docScene';
import { documentSpecs } from './toScene';

const DATA: SequenceData = {
  participants: [{ id: 'a', label: 'Alice' }, { id: 'b' }],
  steps: [
    { kind: 'message', id: 'm1', from: 'a', to: 'b', text: 'hello', line: 'solid', head: 'arrow' },
    { kind: 'note', id: 'n1', over: ['b'], side: 'right', text: 'thinks' },
  ],
};

const DOC: DiagramDocument = {
  pages: [
    { kind: 'graph', id: 'g', width: 400, height: 300, data: { nodes: [{ id: 'x', lines: ['x'], at: { x: 20, y: 20 } }], edges: [] } },
    { kind: 'sequence', id: 's', name: 'Hello', width: 100, height: 100, data: DATA },
  ],
};

function sceneOf(doc: DiagramDocument) {
  const { specs, doc: values } = documentSpecs(doc, { measure: MEASURE, theme: DIAGRAM_THEMES.night! });
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: specs as never, doc: values as SerializedDoc, registry: withDiagramRegistry(),
  });
}

describe('sequence pages', () => {
  it('draws a sequence page as one root holding its data, and grows the page to hold its layout', () => {
    const { specs, doc } = documentSpecs(DOC, { measure: MEASURE });
    const root = specs.find((s) => s.id === sequenceRootIdOf('s'))!;
    expect(sequenceRootOf(root)?.sequence).toBe(DATA);
    expect(specs.some((s) => s.id === 'x')).toBe(true);
    const page = (doc[PAGES_DOC_KEY] as { pages: { id: string; width: number; height: number }[] }).pages[1]!;
    expect(page.width).toBeGreaterThan(100);
    expect(root.pose.width).toBeLessThan(page.width);
  });

  it('reads a page holding a sequence back as a sequence page, its parts left out', () => {
    const doc = documentFromScene(sceneOf(DOC));
    expect(doc.pages.map((p) => p.kind)).toEqual(['graph', 'sequence']);
    const seq = doc.pages[1] as SequencePage;
    expect(seq.data).toEqual(DATA);
    expect(seq.name).toBe('Hello');
    expect(doc.pages[0]!.kind === 'graph' && doc.pages[0]!.data.nodes.map((n) => n.id)).toEqual(['x']);
  });

  it('answers which kinds a scene holds from its roots, and which formats can take them', () => {
    const kinds = scenePageKinds(sceneOf(DOC));
    expect([...kinds].sort()).toEqual(['graph', 'sequence']);
    expect([...scenePageKinds(sceneOf({ pages: [DOC.pages[0]!] }))]).toEqual(['graph']);
    expect([...scenePageKinds(sceneOf({ pages: [DOC.pages[1]!] }))]).toEqual(['sequence']);
    expect(formatTakes(DIAGRAM_JSON, kinds)).toBe(true);
    expect(formatTakes(DIAGRAM_DOT, kinds)).toBe(false);
  });

  it('round-trips through the JSON format', async () => {
    const back = await DIAGRAM_JSON.read!(DIAGRAM_JSON.write!(DOC).text);
    expect(back.document).toEqual(DOC);
  });

  it('exports a sequence page as SVG, its heads and text drawn', async () => {
    const scene = sceneOf(DOC);
    const page = placedPagesOf(scene)[1]!;
    const svg = new DOMParser().parseFromString(await exportPageSvg(scene, page), 'image/svg+xml');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(4);
    expect(svg.documentElement.textContent).toContain('Alice');
  });

  it('writes a body\'s text inside its box, in the frame the body stores it in', async () => {
    const scene = sceneOf(DOC);
    const svg = new DOMParser().parseFromString(await exportPageSvg(scene, placedPagesOf(scene)[0]!), 'image/svg+xml');
    const text = [...svg.querySelectorAll('text')].find((t) => t.textContent === 'x')!;
    expect(Number(text.getAttribute('x'))).toBeGreaterThan(20);
    expect(Number(text.getAttribute('y'))).toBeGreaterThanOrEqual(20);
  });
});
