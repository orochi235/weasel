import { describe, expect, it } from 'vitest';
import { applyDiagramTheme } from './applyTheme';
import { diagramThemeOf } from './resolve';
import { addThemeRole, forkTheme, removeThemeRole, setThemeValue } from './themeEdit';
import { colorOf, themedScene } from './themeFixture';
import { DIAGRAM_THEMES } from './themes';
import { DIAGRAM_THEME_KEY } from './types';

const paper = DIAGRAM_THEMES.paper!;

describe('editing the theme a scene is in', () => {
  it('folds applies made under one key into one undo entry, which restores the theme before them', () => {
    const scene = themedScene();
    applyDiagramTheme(scene, paper);
    const depth = scene.historyIndex();
    let theme = forkTheme(paper);
    for (const fill of ['#110000', '#220000', '#330000']) {
      theme = setThemeValue(theme, ['roles', 'default', 'fill'], fill);
      applyDiagramTheme(scene, theme, 'Edit theme', { coalesceKey: 'theme:roles.default.fill' });
    }
    expect(scene.historyIndex()).toBe(depth + 1);
    expect(colorOf(scene, 'c', 'fill')).toBe('#330000');
    expect(diagramThemeOf(scene)).toEqual(theme);
    scene.undo();
    expect(colorOf(scene, 'c', 'fill')).toBe(paper.roles.default!.fill);
    expect(scene.doc.get(DIAGRAM_THEME_KEY)).toBe('paper');
  });

  it('draws a removed role’s shapes in the default role', () => {
    const scene = themedScene();
    const { theme, id } = addThemeRole(forkTheme(paper), 'Hot');
    const hot = setThemeValue(theme, ['roles', id, 'fill'], '#ff0000');
    applyDiagramTheme(scene, { ...hot, roles: { ...hot.roles, accent: hot.roles[id]! } });
    expect(colorOf(scene, 'a', 'fill')).toBe('#ff0000');
    applyDiagramTheme(scene, removeThemeRole(forkTheme(paper), 'accent'));
    expect(colorOf(scene, 'a', 'fill')).toBe(paper.roles.default!.fill);
  });
});
