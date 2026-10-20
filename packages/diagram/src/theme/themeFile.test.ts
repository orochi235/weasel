import { describe, expect, it } from 'vitest';
import { addThemeRole, forkTheme } from './themeEdit';
import { DIAGRAM_THEME_EXTENSION, parseDiagramTheme, themeToJson } from './themeFile';
import { DIAGRAM_THEMES } from './themes';

const night = DIAGRAM_THEMES.night!;
const errorsOf = (json: string): readonly string[] => {
  const result = parseDiagramTheme(json);
  return 'errors' in result ? result.errors : [];
};
const edited = (change: (raw: Record<string, any>) => void): string => {
  const raw = JSON.parse(themeToJson(night));
  change(raw);
  return JSON.stringify(raw);
};

describe('theme files', () => {
  it('names its extension', () => {
    expect(DIAGRAM_THEME_EXTENSION).toBe('.weasel-theme.json');
  });

  it('round-trips every shipped theme, and a custom one with roles of its own', () => {
    const custom = addThemeRole(forkTheme(night), 'Extra').theme;
    for (const theme of [...Object.values(DIAGRAM_THEMES), custom]) {
      expect(parseDiagramTheme(themeToJson(theme))).toEqual({ theme });
    }
  });

  it('reads text that is not JSON, or not a theme, as an error', () => {
    expect(errorsOf('{')).toHaveLength(1);
    expect(errorsOf('[]')).toEqual(['a theme is an object']);
  });

  it('names a default role the theme does not have', () => {
    expect(errorsOf(edited((t) => { t.defaultRole = 'gone'; }))).toEqual(['defaultRole: no role "gone"']);
  });

  it('names a bad color by where it is', () => {
    expect(errorsOf(edited((t) => { t.roles.accent.fill = 'not-a-color'; }))).toEqual(['roles.accent.fill: "not-a-color" is not a color']);
    expect(errorsOf(edited((t) => { t.lane.bodies[1].stroke = 7; }))).toEqual(['lane.bodies.1.stroke: 7 is not a color']);
    expect(errorsOf(edited((t) => { t.series[0] = '#zzz'; }))).toEqual(['series.0: "#zzz" is not a color']);
  });

  it('names a missing field', () => {
    expect(errorsOf(edited((t) => { delete t.page; }))).toEqual(['page: undefined is not a color']);
    expect(errorsOf(edited((t) => { delete t.name; }))).toEqual(['name: missing']);
    expect(errorsOf(edited((t) => { t.font.size = -1; }))).toEqual(['font.size: -1 is not a size']);
  });
});
