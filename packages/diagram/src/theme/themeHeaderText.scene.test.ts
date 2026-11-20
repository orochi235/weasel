import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { diagramScene } from '../fromData';
import { applyDiagramTheme, setDiagramColor } from './applyTheme';
import { DIAGRAM_THEMES } from './themes';
import { DIAGRAM_THEME_KEY, type DiagramTheme } from './types';

const paper = DIAGRAM_THEMES.paper!;
const white: DiagramTheme = { ...paper, id: 'white-head', name: 'White head', roles: { ...paper.roles, default: { ...paper.roles.default!, headerText: '#ffffff' } } };
const DATA = { nodes: [{ id: 'h', rows: [{ kind: 'header' as const, text: 'H' }, { kind: 'label' as const, text: 'x' }] }], edges: [] };

const sceneIn = (theme: DiagramTheme, colors?: { fill: string }) => {
  const data = colors ? { ...DATA, nodes: [{ ...DATA.nodes[0]!, colors }] } : DATA;
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: diagramScene(data, { theme }) as never, registry: withDiagramRegistry(),
  });
  scene.doc.set(DIAGRAM_THEME_KEY, theme);
  return scene;
};
const headerText = (scene: ReturnType<typeof sceneIn>) => {
  const row = scene.childrenOf('h' as never).find((c) => (scene.get(c)!.data as { bodyRow?: number }).bodyRow === 0)!;
  return (scene.get(row)!.data as { fill: { paint: { color: string } } }).fill.paint.color;
};

describe("a hand fill on a shape whose theme names its header's text color", () => {
  it('leaves the header text in the theme color, as a shape built with that fill has it, through a theme apply', () => {
    const scene = sceneIn(white);
    setDiagramColor(scene, ['h'], 'fill', '#123456');
    expect(headerText(scene)).toBe(headerText(sceneIn(white, { fill: '#123456' })));
    applyDiagramTheme(scene, white);
    expect(headerText(scene)).toBe('#ffffff');
  });

  it('still reaches the header text where the theme names none', () => {
    const scene = sceneIn(paper);
    setDiagramColor(scene, ['h'], 'fill', '#123456');
    expect(headerText(scene)).toBe('#123456');
  });
});
