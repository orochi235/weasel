import { describe, expect, it } from 'vitest';
import {
  addThemeRole, editableTheme, forkTheme, isShippedTheme, removeThemeRole, renameThemeRole, setThemeValue, themeRoles,
  themeValue, type ThemePath,
} from './themeEdit';
import { DIAGRAM_THEMES } from './themes';
import type { DiagramTheme } from './types';

const paper = DIAGRAM_THEMES.paper!;
const snapshot = JSON.stringify(paper);

describe('forkTheme', () => {
  it('copies a shipped theme as a custom one named for it, and leaves the shipped one alone', () => {
    const fork = forkTheme(paper);
    expect(fork.name).toBe('Paper (edited)');
    expect(fork.id).not.toBe(paper.id);
    expect(isShippedTheme(paper)).toBe(true);
    expect(isShippedTheme(fork)).toBe(false);
    const edited = setThemeValue(fork, ['roles', 'default', 'fill'], '#ff0000');
    expect(edited.roles.default!.fill).toBe('#ff0000');
    expect(JSON.stringify(paper)).toBe(snapshot);
  });

  it('forks only a shipped theme: a custom one is edited in place', () => {
    const fork = editableTheme(paper);
    expect(fork).not.toBe(paper);
    expect(editableTheme(fork)).toBe(fork);
  });
});

describe('setThemeValue', () => {
  const cases: [ThemePath, string | number][] = [
    [['roles', 'accent', 'stroke'], '#010203'],
    [['roles', 'muted', 'text'], '#010204'],
    [['edge', 'stroke'], '#010205'],
    [['label', 'fill'], '#010206'],
    [['container', 'fill'], '#010207'],
    [['lane', 'header', 'stroke'], '#010208'],
    [['lane', 'bodies', 1, 'fill'], '#010209'],
    [['page'], '#01020a'],
    [['font', 'family'], 'serif'],
    [['font', 'size'], 16],
    [['series', 2], '#01020b'],
  ];
  it.each(cases)('sets %j', (path, value) => {
    const next = setThemeValue(forkTheme(paper), path, value);
    expect(themeValue(next, path)).toBe(value);
    expect(themeValue(paper, path)).not.toBe(value);
  });

  it('leaves every other value as it was', () => {
    const fork = forkTheme(paper);
    const next = setThemeValue(fork, ['roles', 'accent', 'fill'], '#000000');
    expect(next.roles.default).toBe(fork.roles.default);
    expect(next.roles.accent!.stroke).toBe(fork.roles.accent!.stroke);
    expect(next.edge).toBe(fork.edge);
  });
});

describe('roles', () => {
  it('adds a role in the default role colors, named and listed after the shipped ones', () => {
    const { theme, id } = addThemeRole(forkTheme(paper), 'Critical path');
    expect(id).toBe('critical-path');
    expect(theme.roles[id]).toEqual(paper.roles.default);
    expect(themeRoles(theme).at(-1)).toEqual({ id, label: 'Critical path' });
    expect(addThemeRole(theme, 'Critical path').id).toBe('critical-path-2');
  });

  it('renames a role without changing the id shapes name it by', () => {
    const theme = renameThemeRole(forkTheme(paper), 'accent', 'Highlight');
    expect(themeRoles(theme).find((r) => r.id === 'accent')?.label).toBe('Highlight');
    expect(theme.roles.accent).toEqual(paper.roles.accent);
  });

  it('removes a role, but never the default one', () => {
    const fork: DiagramTheme = forkTheme(paper);
    const theme = removeThemeRole(fork, 'warning');
    expect(theme.roles.warning).toBeUndefined();
    expect(themeRoles(theme).map((r) => r.id)).not.toContain('warning');
    expect(removeThemeRole(fork, 'default')).toBe(fork);
  });

  it('drops a removed role’s label with it', () => {
    const { theme, id } = addThemeRole(forkTheme(paper), 'Extra');
    expect(removeThemeRole(theme, id).roleLabels?.[id]).toBeUndefined();
  });
});
