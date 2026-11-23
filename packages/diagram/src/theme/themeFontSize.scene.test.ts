import { describe, expect, it } from 'vitest';
import { applyDiagramTheme, diagramStyleOf, setDiagramFontSize, setDiagramStyle } from './applyTheme';
import { forkTheme, setThemeValue } from './themeEdit';
import { AB, themedScene } from './themeFixture';
import { DIAGRAM_THEMES } from './themes';

const sizeOf = (scene: ReturnType<typeof themedScene>, id: string) =>
  (scene.get(id as never)!.data as { style: { fontSize: number } }).style.fontSize;

const night = DIAGRAM_THEMES.night!;
const sized = (size: number) => setThemeValue(forkTheme(night), ['font', 'size'], size);

describe('a theme font size change', () => {
  it('moves every text the theme sized by the same step, labels and smaller rows included', () => {
    const scene = themedScene();
    applyDiagramTheme(scene, night);
    applyDiagramTheme(scene, sized(16));
    expect(sizeOf(scene, 'c/1')).toBe(16);
    expect(sizeOf(scene, 'b/2')).toBe(16);
    expect(sizeOf(scene, `${AB}/label`)).toBe(14);
    scene.undo();
    expect(sizeOf(scene, 'c/1')).toBe(12);
  });

  it('leaves a size the author set by hand, through a theme change and a role change', () => {
    const scene = themedScene();
    applyDiagramTheme(scene, night);
    setDiagramFontSize(scene, ['c', AB], 20);
    expect(sizeOf(scene, 'c/1')).toBe(20);
    expect(sizeOf(scene, `${AB}/label`)).toBe(20);
    expect(diagramStyleOf(scene.get('c' as never)!)?.ownFont).toEqual(['size']);
    setDiagramStyle(scene, ['c'], 'accent', { theme: night });
    applyDiagramTheme(scene, sized(16));
    expect(sizeOf(scene, 'c/1')).toBe(20);
    expect(sizeOf(scene, `${AB}/label`)).toBe(20);
    expect(sizeOf(scene, 'a/1')).toBe(16);
  });

  it('puts a row it took below the floor back where it was on the step back', () => {
    const scene = themedScene();
    applyDiagramTheme(scene, sized(20));
    setDiagramFontSize(scene, ['c'], 4);
    const c = scene.get('c' as never)!.data as { diagram: Record<string, unknown> };
    scene.update('c' as never, { data: { ...c, diagram: { ...c.diagram, ownFont: [] } } });
    applyDiagramTheme(scene, sized(12));
    expect(sizeOf(scene, 'c/1')).toBe(1);
    applyDiagramTheme(scene, sized(14));
    expect(sizeOf(scene, 'c/1')).toBe(1);
    applyDiagramTheme(scene, sized(20));
    expect(sizeOf(scene, 'c/1')).toBe(4);
    expect(scene.get('c/1' as never)!.data).not.toHaveProperty('unclampedFontSize');
  });
});

describe('a text size set by hand', () => {
  it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])('throws on %s and writes nothing', (size) => {
    const scene = themedScene();
    const before = sizeOf(scene, 'c/1');
    expect(() => setDiagramFontSize(scene, ['c'], size)).toThrow(RangeError);
    expect(sizeOf(scene, 'c/1')).toBe(before);
    expect(diagramStyleOf(scene.get('c' as never)!)!.ownFont).toEqual([]);
  });
});
