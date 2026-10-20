import { describe, expect, it } from 'vitest';
import { applyDiagramTheme, diagramStyleOf, setDiagramColor, setDiagramStyle } from './applyTheme';
import { diagramThemeOf } from './resolve';
import { DIAGRAM_THEMES } from './themes';
import { DIAGRAM_THEME_KEY, type DiagramTheme } from './types';
import { AB, colorOf, themedScene } from './themeFixture';

const { blueprint, pastel } = DIAGRAM_THEMES as Record<string, DiagramTheme>;
const datas = (scene: ReturnType<typeof themedScene>) => scene.renderOrderNodes().map((n) => [n.id, n.data]);

describe('applying a theme to a scene', () => {
  it('is one undo entry, which restores every color and the document value', () => {
    const scene = themedScene();
    const before = datas(scene);
    applyDiagramTheme(scene, blueprint!);
    expect(colorOf(scene, 'c', 'fill')).toBe(blueprint!.roles.default!.fill);
    expect(scene.doc.get(DIAGRAM_THEME_KEY)).toBe('blueprint');
    expect(diagramThemeOf(scene)).toBe(blueprint);
    expect(scene.undo()).toBe(true);
    expect(datas(scene)).toEqual(before);
    expect(scene.doc.get(DIAGRAM_THEME_KEY)).toBeUndefined();
    expect(scene.canUndo()).toBe(false);
  });

  it('saves a custom theme whole, so a reader without it still has it', () => {
    const scene = themedScene();
    const custom: DiagramTheme = { ...blueprint!, id: 'mine', name: 'Mine', page: '#000000' };
    applyDiagramTheme(scene, custom);
    expect(scene.doc.get(DIAGRAM_THEME_KEY)).toEqual(custom);
    expect(diagramThemeOf(scene).page).toBe('#000000');
  });
});

describe('setting a role', () => {
  it('names the role on the trait and recolors the shape, in one undo entry', () => {
    const scene = themedScene();
    applyDiagramTheme(scene, pastel!);
    setDiagramStyle(scene, ['c', AB], 'negative');
    expect(diagramStyleOf(scene.get('c' as never)!)?.role).toBe('negative');
    expect(colorOf(scene, 'c', 'fill')).toBe(pastel!.roles.negative!.fill);
    expect(colorOf(scene, AB, 'stroke')).toBe(pastel!.roles.negative!.stroke);
    scene.undo();
    expect(diagramStyleOf(scene.get('c' as never)!)?.role).toBeUndefined();
    expect(colorOf(scene, 'c', 'fill')).toBe(pastel!.roles.default!.fill);
  });

  it('gives back colors the author had set, so the role shows', () => {
    const scene = themedScene();
    setDiagramStyle(scene, ['b'], 'accent', { theme: pastel! });
    expect(colorOf(scene, 'b', 'fill')).toBe(pastel!.roles.accent!.fill);
    expect(diagramStyleOf(scene.get('b' as never)!)?.own).toEqual([]);
  });
});

describe('a color set by hand', () => {
  it('is kept through a theme change', () => {
    const scene = themedScene();
    setDiagramColor(scene, ['c'], 'stroke', '#ff00ff');
    expect(diagramStyleOf(scene.get('c' as never)!)?.own).toEqual(['stroke']);
    applyDiagramTheme(scene, blueprint!);
    expect(colorOf(scene, 'c', 'stroke')).toBe('#ff00ff');
    expect(colorOf(scene, 'c', 'fill')).toBe(blueprint!.roles.default!.fill);
  });

  it("colors a shape's text rows, and a connector's label", () => {
    const scene = themedScene();
    setDiagramColor(scene, ['c', AB], 'text', '#00ff00');
    for (const id of scene.childrenOf('c' as never)) expect(colorOf(scene, id, 'fill')).toBe('#00ff00');
    expect(colorOf(scene, `${AB}/label`, 'fill')).toBe('#00ff00');
    applyDiagramTheme(scene, blueprint!);
    expect(colorOf(scene, `${AB}/label`, 'fill')).toBe('#00ff00');
  });
});
