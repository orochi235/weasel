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
});
