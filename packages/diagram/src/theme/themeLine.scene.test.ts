import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { diagramScene } from '../fromData';
import type { DiagramData } from '../dataTypes';
import { applyDiagramTheme } from './applyTheme';
import { DIAGRAM_THEMES } from './themes';
import { DIAGRAM_THEME_KEY, type DiagramTheme } from './types';
import { THEMED } from './themeFixture';

const { paper, blueprint, night } = DIAGRAM_THEMES as Record<string, DiagramTheme>;
type Lined = { stroke?: { width?: number; dash?: number[] } };

const DATA: DiagramData = {
  ...THEMED,
  nodes: [...THEMED.nodes, { id: 'd', lines: ['d'], colors: { strokeWidth: 5 } }],
  edges: [...THEMED.edges!, { from: 'c', to: 'd', colors: { width: 4 } }],
};

function sceneIn(theme: DiagramTheme) {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: diagramScene(DATA, { theme }) as never, registry: withDiagramRegistry(),
  });
  scene.doc.set(DIAGRAM_THEME_KEY, theme.id);
  return scene;
}

const lines = (scene: ReturnType<typeof sceneIn>) => new Map(scene.renderOrderNodes()
  .filter((n) => (n.data as Lined)?.stroke !== undefined)
  .map((n) => { const s = (n.data as Lined).stroke!; return [n.id, { width: s.width, dash: s.dash?.length ? s.dash : undefined }]; }));

describe('applying a theme to a scene built in another', () => {
  it.each([[paper, blueprint], [paper, night], [night, paper], [blueprint, paper]])(
    'draws every outline and connector as a scene built in it does (%#)', (from, to) => {
      const scene = sceneIn(from!);
      applyDiagramTheme(scene, to!);
      expect(lines(scene)).toEqual(lines(sceneIn(to!)));
    },
  );

  it('keeps a width the author set', () => {
    const scene = sceneIn(paper!);
    applyDiagramTheme(scene, blueprint!);
    expect((scene.get('d' as never)!.data as Lined).stroke!.width).toBe(5);
  });
});
