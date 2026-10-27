/** A boolean group saves as the path it draws and opens again as the boolean group. */
import { describe, expect, it } from 'vitest';
import { booleanGroupFields, createScene, pathContainsPoint, PAGES_DOC_KEY, solid } from '@weasel-js/core';
import { parseSvg } from '@weasel-js/svg';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { openSvgText } from './openSvg';
import { sceneToSvgString } from './svgExport';
import { SWILL_NAMESPACES } from './svgInterop';

const PAGE = { id: 'page-1', width: 400, height: 400 };

function makeScene() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }], doc: { [PAGES_DOC_KEY]: { pages: [PAGE] } },
  });
  const group = scene.add({
    ...booleanGroupFields<WeaselDrawPose>(), layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { fill: { paint: solid('#ff0000') }, boolean: 'subtract' },
  });
  for (const at of [0, 50]) {
    scene.add({
      kind: 'mark', layer: 'default', parent: group, pose: { x: at, y: at, width: 100, height: 100 },
      data: { path: { kind: 'rect', x: at, y: at, width: 100, height: 100 }, fill: { paint: solid('#0000ff') } },
    });
  }
  return scene;
}

const save = (scene: ReturnType<typeof makeScene>) =>
  sceneToSvgString(scene, { filename: 'b.svg', pages: [{ ...PAGE, x: 0, y: 0, index: 0 }], backgroundColor: '#ffffff' });

describe('a boolean group through SVG', () => {
  it('writes the result as a visible path, in the group\'s paint, and its children hidden', async () => {
    const parsed = parseSvg(await save(makeScene()), { namespaces: SWILL_NAMESPACES });
    const [g] = parsed.nodes;
    expect(g!.kind).toBe('group');
    const [self, operands] = (g as { children: unknown[] }).children as [
      { kind: string; path: never; fill: unknown }, { boolean?: string; hidden?: boolean },
    ];
    expect(self.kind).toBe('path');
    expect(self.fill).toMatchObject({ kind: 'solid', color: '#ff0000' });
    expect(pathContainsPoint(self.path, 25, 25)).toBe(true);
    expect(pathContainsPoint(self.path, 75, 75)).toBe(false);
    expect(operands).toMatchObject({ boolean: 'subtract', hidden: true });
  });

  it('opens as the boolean group, its children under it and shown', async () => {
    const scene = makeScene();
    openSvgText(scene, await save(scene), 'b.svg');
    expect(scene.roots).toHaveLength(1);
    const group = scene.get(scene.roots[0]!)!;
    expect(group).toMatchObject({ kind: 'mark', consumesChildren: true, dependsOn: 'children' });
    expect(group.data).toMatchObject({ boolean: 'subtract', fill: { paint: { color: '#ff0000' } } });
    expect(group.data.path).toBeUndefined();
    const kids = scene.childrenOf(group.id);
    expect(kids).toHaveLength(2);
    expect(kids.every((id) => !scene.get(id)!.hidden)).toBe(true);
  });
});
