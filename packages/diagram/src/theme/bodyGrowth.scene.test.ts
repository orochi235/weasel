import { describe, expect, it } from 'vitest';
import { scenePoseFrame } from '@weasel-js/core';
import { applyDiagramTheme, setDiagramFontSize } from './applyTheme';
import { forkTheme, setThemeValue } from './themeEdit';
import { themedScene } from './themeFixture';
import { DIAGRAM_THEMES } from './themes';

type Box = { x: number; y: number; width: number; height: number };
const night = DIAGRAM_THEMES.night!;
const sized = (size: number) => setThemeValue(forkTheme(night), ['font', 'size'], size);

function setup() {
  const scene = themedScene();
  applyDiagramTheme(scene, night);
  // Where each draws: a row is stored in its body's frame.
  return { scene, box: (id: string) => scenePoseFrame(scene as never).world(id as never) as Box };
}

const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

describe('a body whose text grows', () => {
  it('grows to fit its rows and stacks them again, in the same undo entry', () => {
    const { scene, box } = setup();
    const before = { c: box('c'), b: box('b') };
    applyDiagramTheme(scene, sized(30));
    expect(box('c/1').height).toBeGreaterThanOrEqual(36);
    expect(box('c').height).toBeGreaterThan(before.c.height);
    expect(box('c').x).toBe(before.c.x);
    expect(inside(box('c/1'), box('c'))).toBe(true);
    expect(inside(box('b/1'), box('b'))).toBe(true);
    expect(inside(box('b/2'), box('b'))).toBe(true);
    expect(box('b/1').y + box('b/1').height).toBeLessThanOrEqual(box('b/2').y);
    scene.undo();
    expect(box('c')).toEqual(before.c);
    expect(box('b')).toEqual(before.b);
  });

  it('keeps a body the author made larger at that size, its rows inside it', () => {
    const { scene, box } = setup();
    scene.setPose('c' as never, { ...box('c'), width: 300, height: 200 } as never);
    applyDiagramTheme(scene, sized(20));
    expect(box('c').width).toBe(300);
    expect(box('c').height).toBe(200);
    expect(inside(box('c/1'), box('c'))).toBe(true);
    expect(box('c/1').width).toBeGreaterThan(200);
  });

  it('grows under a size set by hand too', () => {
    const { scene, box } = setup();
    const before = box('c').height;
    setDiagramFontSize(scene, ['c'], 40);
    expect(box('c').height).toBeGreaterThan(before);
    expect(inside(box('c/1'), box('c'))).toBe(true);
  });
});
