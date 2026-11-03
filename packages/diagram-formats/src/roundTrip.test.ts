import { describe, expect, it } from 'vitest';
import { pagesOf } from '@weasel-js/core';
import { setDiagramColor, type DiagramSceneData } from '@weasel-js/diagram';
import { documentFromScene } from './fromScene';
import { DIAGRAM_JSON } from './jsonFormat';
import { documentSpecs } from './toScene';
import { MEASURE, contentNodes, docScene, drawnScene, type DocScene } from './testing/docScene';

/** The scene `scene` comes back as through a document. */
function throughDocument(scene: DocScene, viaJson = false): DocScene {
  let doc = documentFromScene(scene);
  if (viaJson) doc = (DIAGRAM_JSON.read!(DIAGRAM_JSON.write!(doc).text) as { document: typeof doc }).document;
  return drawnScene(documentSpecs(doc, { measure: MEASURE }));
}

/** A scene with a hand-set color and an edge whose ports and route are its author's. */
function edited(): DocScene {
  const scene = docScene();
  setDiagramColor(scene as never, ['a'], 'stroke', '#00ff00');
  setDiagramColor(scene as never, ['ab'], 'text', '#ff00ff');
  const data = scene.get('bm' as never)!.data as DiagramSceneData & { diagram: Record<string, unknown> };
  scene.update('bm' as never, { data: { ...data, diagram: { ...data.diagram, from: { port: 'bottom' }, waypoints: [{ x: 250, y: 400 }] } } });
  return scene;
}

const poses = (scene: DocScene) => Object.fromEntries(
  contentNodes(scene).filter((n) => n.dependsOn === undefined).map((n) => [n.id, n.pose]),
);
const colors = (scene: DocScene) => Object.fromEntries(contentNodes(scene).map((n) => {
  const d = n.data as DiagramSceneData;
  return [n.id, [(d.fill?.paint as { color?: string } | undefined)?.color, (d.stroke?.paint as { color?: string } | undefined)?.color]];
}));

describe('scene to document and back', () => {
  it('reads back the same document', () => {
    const scene = edited();
    expect(documentFromScene(throughDocument(scene))).toEqual(documentFromScene(scene));
  });

  it('gives every shape, container, pool, and lane the same box', () => {
    const scene = edited();
    expect(poses(throughDocument(scene))).toEqual(poses(scene));
  });

  it('gives everything the same colors, and keeps the hand-set ones the author\'s', () => {
    const scene = edited();
    const back = throughDocument(scene);
    expect(colors(back)).toEqual(colors(scene));
    expect((back.get('a' as never)!.data as { diagram: { ownStyle?: string[] } }).diagram.ownStyle).toEqual(['stroke']);
  });

  it('keeps edges\' ends, routers, waypoints, and labels', () => {
    const back = throughDocument(edited());
    const bm = (back.get('bm' as never)!.data as { diagram: Record<string, unknown> }).diagram;
    expect(bm).toMatchObject({ from: { port: 'bottom' }, router: 'straight', waypoints: [{ x: 250, y: 400 }] });
    expect((back.get('ab/label' as never)!.data as { text: string }).text).toBe('yes');
    expect(back.get('ac' as never)?.dependsOn).toEqual(['a', 'c']);
  });

  it('keeps the pages and the theme', () => {
    const scene = edited();
    const back = throughDocument(scene);
    expect(pagesOf(back)).toEqual(pagesOf(scene));
    expect(back.doc.get('diagram:theme')).toBe('night');
  });

  it('survives the native JSON format', () => {
    const scene = edited();
    expect(documentFromScene(throughDocument(scene, true))).toEqual(documentFromScene(scene));
  });
});
