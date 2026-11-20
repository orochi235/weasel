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

  it('refuses a default role named like an Object.prototype member that the roles do not hold', () => {
    expect(errorsOf(edited((raw) => { raw.defaultRole = 'toString'; }))).toEqual(['defaultRole: no role "toString"']);
  });

  it('checks the optional fields the scene writers paint and size with', () => {
    const errors = errorsOf(edited((raw) => {
      Object.assign(raw.roles.default, { header: 5, headerText: null, strokeWidth: 'x', dash: 'a' });
      Object.assign(raw.edge, { label: 7, width: -1, dash: [1, 'x'], markerEnd: 3, trim: { end: 'x' } });
      raw.lane.bodies[0].strokeWidth = Number.NaN;
      raw.series = [];
    }));
    for (const path of ['roles.default.header', 'roles.default.headerText', 'roles.default.strokeWidth', 'roles.default.dash',
      'edge.label', 'edge.width', 'edge.dash', 'edge.markerEnd', 'edge.trim', 'lane.bodies.0.strokeWidth', 'series']) {
      expect(errors.some((e) => e.startsWith(`${path}:`)), path).toBe(true);
    }
  });

  it('refuses a font size too large to be a number', () => {
    const json = edited((raw) => { raw.font.size = 999; }).replace('"size":999', '"size":1e400');
    expect(errorsOf(json)).toEqual(['font.size: null is not a size']);
  });

  it('takes a marker given as null or as a key with a size', () => {
    expect(errorsOf(edited((raw) => { Object.assign(raw.edge, { markerStart: null, markerEnd: { key: 'arrow', size: 4 } }); }))).toEqual([]);
  });
});
