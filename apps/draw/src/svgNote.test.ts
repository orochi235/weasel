import { describe, expect, it } from 'vitest';
import { asNodeId, contentRoots, layoutPages, solid, stickyData, type NodeId } from '@weasel-js/core';
import { openSvgText } from './openSvg';
import { sceneToSvgString } from './svgExport';
import { decodeNoteAttrs, encodeNoteAttrs } from './svgNote';
import { drawScene } from './testScenes';
import type { WeaselDrawData } from './drawDocument';

const PAGE = { id: 'page-1', width: 400, height: 300 };
const POSE = { x: 40, y: 30, width: 160, height: 120 };

// A note's `runs` are readonly where the scene's are not; a note made here has none.
const note = (look: Parameters<typeof stickyData>[0]) => stickyData(look) as WeaselDrawData;

async function saveAndOpen(data: WeaselDrawData, pose: typeof POSE & { rotation?: number } = POSE) {
  const scene = drawScene([PAGE]);
  scene.add({ kind: 'mark', layer: 'default', id: asNodeId('note'), parent: asNodeId('page-1'), pose, data });
  const svg = await sceneToSvgString(scene, { filename: 'notes', pages: layoutPages([PAGE]), backgroundColor: '#ffffff' });
  const opened = drawScene([PAGE]);
  openSvgText(opened, svg, 'notes.svg');
  const leaves: NodeId[] = [];
  const walk = (id: NodeId) => {
    if (opened.get(id)!.kind === 'mark') leaves.push(id);
    for (const c of opened.childrenOf(id)) walk(c);
  };
  for (const id of contentRoots(opened)) walk(id);
  return { svg, leaves: leaves.map((id) => opened.get(id)!) };
}

describe('a sticky note through Save and Open', () => {
  it('comes back as one note, with its paper, padding, clip, edge, shadow and minimum size', async () => {
    const data = note({ text: 'Remember the milk', background: { paint: solid('#c8ecff') } });
    const { leaves } = await saveAndOpen(data);
    expect(leaves).toHaveLength(1);
    const [read] = leaves;
    expect(read!.pose).toMatchObject(POSE);
    expect(read!.data).toMatchObject({
      text: 'Remember the milk',
      background: { paint: { color: '#c8ecff' } },
      padding: data.padding,
      overflow: 'clip',
      edge: data.edge,
      shadow: data.shadow,
      minSize: data.minSize,
      verticalAlign: data.verticalAlign,
      style: data.style,
    });
  });

  it('keeps a turned note turned', async () => {
    const { leaves } = await saveAndOpen(note({ text: 'tilted' }), { ...POSE, rotation: 0.2 });
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.pose).toMatchObject({ ...POSE, rotation: expect.closeTo(0.2) });
    expect(leaves[0]!.data.background).toBeDefined();
  });
});

describe('note attributes', () => {
  it('decode what they encode, and leave out a malformed one', () => {
    const fields = { edge: { width: 1, shade: 0.18 }, shadow: { x: 0, y: 2, blur: 6, alpha: 0.18 }, minSize: { width: 48, height: 40 } };
    expect(decodeNoteAttrs(encodeNoteAttrs(fields))).toEqual(fields);
    expect(decodeNoteAttrs({ edge: '1', shadow: 'a b c d', 'min-size': '4 5' })).toEqual({ minSize: { width: 4, height: 5 } });
  });
});
