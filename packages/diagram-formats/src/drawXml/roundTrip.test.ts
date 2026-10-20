import { beforeAll, describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY, createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry, type DiagramSceneData } from '@weasel-js/diagram';
import type { DiagramDocument } from '../document';
import { documentFromScene } from '../fromScene';
import { documentSpecs } from '../toScene';
import { MEASURE, THEME, docScene, type DocScene } from '../testing/docScene';
import { DRAW_XML } from './format';

/** The scene `scene` comes back as through draw-style XML, and the warnings both ways. */
async function throughXml(scene: DocScene): Promise<{ back: DocScene; doc: DiagramDocument; warnings: string[] }> {
  const written = DRAW_XML.write!(documentFromScene(scene));
  const { document: doc, warnings } = await DRAW_XML.read!(written.text);
  const { specs, doc: values } = documentSpecs(doc, { measure: MEASURE, theme: THEME });
  const back = createScene<unknown, string, RectPose>({
    systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), doc: values, initial: specs as never,
  });
  return { back, doc, warnings: [...written.warnings, ...warnings] };
}

const poses = (scene: DocScene) => Object.fromEntries(
  scene.renderOrderNodes().filter((n) => n.dependsOn === undefined).map((n) => [n.id, n.pose]),
);
const colors = (scene: DocScene) => Object.fromEntries(scene.renderOrderNodes().map((n) => {
  const d = n.data as DiagramSceneData;
  return [n.id, [(d.fill?.paint as { color?: string } | undefined)?.color, (d.stroke?.paint as { color?: string } | undefined)?.color]];
}));
const edgeTrait = (scene: DocScene, id: string) => (scene.get(id as never)!.data as { diagram: Record<string, unknown> }).diagram;

describe('a chart through draw-style XML and back', () => {
  const scene = docScene();
  let result: Awaited<ReturnType<typeof throughXml>>;
  beforeAll(async () => {
    result = await throughXml(scene);
  });

  it('keeps the pages, their names, and their sizes', () => {
    expect(result.back.doc.get(PAGES_DOC_KEY)).toEqual(scene.doc.get(PAGES_DOC_KEY));
  });

  it('gives every shape, container, pool, lane, and title the same box', () => {
    const before = poses(scene);
    delete before.ac;
    expect(poses(result.back)).toEqual(before);
  });

  it('draws everything in the same colors', () => {
    const before = colors(scene);
    const after = colors(result.back);
    for (const id of Object.keys(before).filter((k) => !k.startsWith('ac'))) expect([id, after[id]]).toEqual([id, before[id]]);
  });

  it('keeps the pool, its lanes, and their members', () => {
    const pool = result.doc.pages[1]!.data.containers!.find((c) => c.id === 'p')!;
    expect(pool).toMatchObject({ role: 'pool', axis: 'y', lanes: [{ id: 'l1', label: 'One', members: ['d'] }, { id: 'l2', label: 'Two' }] });
    expect(result.doc.pages[0]!.data.containers!.find((c) => c.id === 'k')).toMatchObject({ role: 'container', label: 'Box', members: ['m'] });
  });

  it('keeps edges\' ends, routers, waypoints, and labels', () => {
    expect(edgeTrait(result.back, 'ab')).toMatchObject({ router: 'orthogonal', waypoints: [{ x: 200, y: 160 }] });
    expect(edgeTrait(result.back, 'bm')).toMatchObject({ router: 'straight' });
    expect(result.back.get('ab' as never)?.dependsOn).toEqual(['a', 'b']);
    expect((result.back.get('ab/label' as never)!.data as { text: string }).text).toBe('yes');
  });

  it('reads back the very document it read, once written again', async () => {
    const again = await DRAW_XML.read!(DRAW_XML.write!(result.doc).text);
    expect(again.document).toEqual(result.doc);
  });

  it('warns that the connector between pages was left out', () => {
    expect(result.back.get('ac' as never)).toBeUndefined();
    expect(result.warnings.some((w) => /between pages/.test(w))).toBe(true);
  });
});
