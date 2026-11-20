import { describe, expect, it } from 'vitest';
import { setDiagramColor, setDiagramFontSize, setDiagramStyle } from './applyTheme';
import { AB, colorOf, themedScene } from './themeFixture';

type Texted = { fill?: { paint: { color: string } }; style?: { fontSize?: number } };
const textOf = (scene: ReturnType<typeof themedScene>, id: string) => scene.get(id as never)!.data as Texted;
const rowsOf = (scene: ReturnType<typeof themedScene>, id: string) =>
  scene.childrenOf(id as never).filter((c) => typeof (scene.get(c)!.data as { text?: unknown }).text === 'string');

describe('a style edit by hand over a locked node', () => {
  it.each([
    ['setDiagramStyle', (s: ReturnType<typeof themedScene>) => setDiagramStyle(s, ['a', 'c', AB], 'negative')],
    ['setDiagramColor', (s: ReturnType<typeof themedScene>) => setDiagramColor(s, ['a', 'c', AB], 'stroke', '#ff0000')],
    ['setDiagramFontSize', (s: ReturnType<typeof themedScene>) => setDiagramFontSize(s, ['a', 'c', AB], 30)],
  ])('%s leaves the locked one and edits the rest', (_, edit) => {
    const scene = themedScene();
    scene.setLocked('c' as never, true);
    const before = scene.get('c' as never)!.data;
    expect(() => edit(scene)).not.toThrow();
    expect(scene.get('c' as never)!.data).toBe(before);
    expect(scene.get('a' as never)!.data).not.toBe(before);
    expect(scene.canUndo()).toBe(true);
  });

  it("leaves a shape's locked text row, and colors its other rows", () => {
    const scene = themedScene();
    const [first, second] = rowsOf(scene, 'b');
    scene.setLocked(first as never, true);
    const before = textOf(scene, first!).fill!.paint.color;
    expect(() => setDiagramColor(scene, ['b'], 'text', '#00ff00')).not.toThrow();
    expect(textOf(scene, first!).fill!.paint.color).toBe(before);
    expect(textOf(scene, second!).fill!.paint.color).toBe('#00ff00');
    expect(colorOf(scene, 'b', 'stroke')).toBeDefined();
  });
});
