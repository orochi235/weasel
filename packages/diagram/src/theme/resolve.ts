import type { Stroke } from '@weasel-js/core';
import type { EdgeStyle, NodeStyle } from '../fromData';
import { DIAGRAM_THEMES } from './themes';
import { DIAGRAM_THEME_KEY, type DiagramTheme } from './types';

/** The style a shape naming `role` is drawn in: that role's, or the theme's default role's. */
export function roleStyle(theme: DiagramTheme, role?: string): NodeStyle {
  return (role !== undefined ? theme.roles[role] : undefined) ?? theme.roles[theme.defaultRole]!;
}

/** The style a connector naming `role` is drawn in: the role's stroke, its label in that stroke too;
 *  with no role, the theme's own connector and label colors. */
export function roleEdgeStyle(theme: DiagramTheme, role?: string): EdgeStyle {
  const own = role !== undefined ? theme.roles[role] : undefined;
  if (own !== undefined) return { ...theme.edge, stroke: own.stroke, label: own.stroke };
  return { ...theme.edge, label: theme.edge.label ?? theme.label.fill };
}

/** The stroke a connector drawn under `theme` starts with, for a connect action's `edgeStroke`. */
export function themeEdgeStroke(theme: DiagramTheme): Stroke {
  const { stroke, width, dash, markerStart, markerEnd } = theme.edge;
  return {
    paint: { color: stroke },
    width: width ?? 2,
    ...(dash ? { dash } : {}),
    ...(markerStart ? { markerStart } : {}),
    ...(markerEnd !== null ? { markerEnd: markerEnd ?? 'arrow' } : {}),
  };
}

/** The theme's face as `diagramScene` and the stencils take one. */
export const themeFont = (theme: DiagramTheme): { fontFamily: string; fontSize: number } =>
  ({ fontFamily: theme.font.family, fontSize: theme.font.size });

/** The face a connector's label is set in: the label's own family, else the theme's. */
export const themeLabelFamily = (theme: DiagramTheme): string => theme.label.font?.family ?? theme.font.family;

/** The theme a document value names: a shipped theme by id, or a whole theme. `fallback` for none,
 *  or for an id no shipped theme has. */
export function diagramThemeFrom(value: unknown, fallback: DiagramTheme = DIAGRAM_THEMES.night!): DiagramTheme {
  if (typeof value === 'string') return DIAGRAM_THEMES[value] ?? fallback;
  if (value !== null && typeof value === 'object' && 'roles' in value) return value as DiagramTheme;
  return fallback;
}

/** The theme a scene's `diagram:theme` value names. */
export function diagramThemeOf(scene: { doc: { get(key: string): unknown } }, fallback?: DiagramTheme): DiagramTheme {
  return diagramThemeFrom(scene.doc.get(DIAGRAM_THEME_KEY), fallback);
}

/** What `diagram:theme` holds for `theme`: a shipped theme's id, or the whole theme. */
export const themeDocValue = (theme: DiagramTheme): string | DiagramTheme =>
  DIAGRAM_THEMES[theme.id] === theme ? theme.id : theme;
