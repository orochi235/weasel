import type { Stroke } from '@weasel-js/core';
import { getOwn, isDev } from '@weasel-js/registry';
import { labelStyleOf } from '../edgeLabel';
import { edgeStrokeOf } from '../edgeStroke';
import type { EdgeStyle, NodeStyle } from '../dataTypes';
import { isShippedTheme } from './themeEdit';
import { DIAGRAM_THEMES } from './themes';
import { DIAGRAM_THEME_KEY, defaultRoleStyle, type DiagramTheme } from './types';

/** The style `theme` holds for `role` itself, if any. */
export const themeRoleStyle = (theme: DiagramTheme, role?: string): NodeStyle | undefined =>
  role !== undefined ? getOwn(theme.roles, role) : undefined;

/** The style a shape naming `role` is drawn in: that role's, or the theme's default role's. */
export function roleStyle(theme: DiagramTheme, role?: string): NodeStyle {
  return themeRoleStyle(theme, role) ?? defaultRoleStyle(theme);
}

/** The style a connector naming `role` is drawn in: the role's stroke, its label in that stroke too;
 *  with no role, the theme's own connector and label colors. */
export function roleEdgeStyle(theme: DiagramTheme, role?: string): EdgeStyle {
  const own = themeRoleStyle(theme, role);
  if (own !== undefined) return { ...theme.edge, stroke: own.stroke, label: own.stroke };
  return { ...theme.edge, label: theme.edge.label ?? theme.label.fill };
}

/** The stroke a connector drawn under `theme` starts with, for a connect action's `edgeStroke`:
 *  the one `diagramScene` draws an edge in with no role. */
export const themeEdgeStroke = (theme: DiagramTheme): Stroke => edgeStrokeOf(theme.edge);

/** The theme's face as `diagramScene` and the stencils take one. */
export const themeFont = (theme: DiagramTheme): { fontFamily: string; fontSize: number } =>
  ({ fontFamily: theme.font.family, fontSize: theme.font.size });

/** The family a connector's label is set in: the label's own, else the theme's. */
export const themeLabelFamily = (theme: DiagramTheme): string => theme.label.font?.family ?? theme.font.family;

/** The face edge labels are sized from, before `labelStyleOf` takes two sizes off: the theme's label
 *  face where it names one, else `font`. */
export const themeLabelFont = (theme: DiagramTheme, font = themeFont(theme)): { fontFamily: string; fontSize: number } =>
  theme.label.font ? { fontFamily: theme.label.font.family, fontSize: theme.label.font.size } : font;

/** The face a new connector label is set in under `theme`. */
export const themeLabelStyle = (theme: DiagramTheme) => labelStyleOf(themeLabelFont(theme));

const warnedThemeIds = new Set<string>();

/** The theme a document value names: a shipped theme by id, or a whole theme. `fallback` for none,
 *  or for an id no shipped theme has, with a development warning once per id. */
export function diagramThemeFrom(value: unknown, fallback: DiagramTheme = DIAGRAM_THEMES.night!): DiagramTheme {
  if (typeof value === 'string') {
    const shipped = getOwn(DIAGRAM_THEMES, value);
    if (shipped) return shipped;
    if (isDev() && !warnedThemeIds.has(value)) {
      warnedThemeIds.add(value);
      console.warn(`@weasel-js/diagram: no theme named '${value}' ships in this build; drawing with '${fallback.id}'`);
    }
    return fallback;
  }
  if (value !== null && typeof value === 'object' && 'roles' in value) return value as DiagramTheme;
  return fallback;
}

/** The theme a scene's `diagram:theme` value names. */
export function diagramThemeOf(scene: { doc: { get(key: string): unknown } }, fallback?: DiagramTheme): DiagramTheme {
  return diagramThemeFrom(scene.doc.get(DIAGRAM_THEME_KEY), fallback);
}

/** What `diagram:theme` holds for `theme`: a shipped theme's id, or the whole theme. */
export const themeDocValue = (theme: DiagramTheme): string | DiagramTheme =>
  isShippedTheme(theme) ? theme.id : theme;
