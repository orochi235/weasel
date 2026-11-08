import { describe, expect, it } from 'vitest';
import { BACKGROUND_KEY, backgroundOf, setBackground } from './docBackground';
import { drawScene } from './testScenes';

describe('the document background', () => {
  it('is white until set', () => {
    expect(backgroundOf(drawScene())).toBe('#ffffff');
  });

  it('is a document value, each change one undo entry', () => {
    const scene = drawScene();
    setBackground(scene, '#336699');
    setBackground(scene, '#112233');
    expect(backgroundOf(scene)).toBe('#112233');
    expect(scene.toJSON().doc).toEqual({ [BACKGROUND_KEY]: '#112233' });
    scene.undo();
    expect(backgroundOf(scene)).toBe('#336699');
    scene.undo();
    expect(backgroundOf(scene)).toBe('#ffffff');
    scene.redo();
    expect(backgroundOf(scene)).toBe('#336699');
  });

  it('keeps no value for white, and writes no entry for the color it already has', () => {
    const scene = drawScene();
    setBackground(scene, '#336699');
    setBackground(scene, '#336699');
    expect(scene.historyEntries()).toHaveLength(1);
    setBackground(scene, '#ffffff');
    expect(scene.toJSON().doc).toBeUndefined();
  });
});
