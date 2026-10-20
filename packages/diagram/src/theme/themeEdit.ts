/**
 * Editing a theme as a value: every edit returns a new theme and leaves the
 * one it was given alone, so a shipped theme is never changed.
 */
import { DIAGRAM_THEMES } from './themes';
import { DIAGRAM_ROLES, type DiagramTheme } from './types';

type BoxField = 'fill' | 'stroke' | 'text';

/** Where one value sits in a {@link DiagramTheme}. */
export type ThemePath =
  | readonly ['roles', string, BoxField]
  | readonly ['edge', 'stroke']
  | readonly ['label', 'fill']
  | readonly ['container', BoxField]
  | readonly ['lane', 'header', BoxField]
  | readonly ['lane', 'bodies', number, BoxField]
  | readonly ['page']
  | readonly ['font', 'family']
  | readonly ['font', 'size']
  | readonly ['series', number];

/** Whether `theme` is one of {@link DIAGRAM_THEMES} itself, which no edit may change. */
export const isShippedTheme = (theme: DiagramTheme): boolean => DIAGRAM_THEMES[theme.id] === theme;

/** A custom copy of `theme`, named "<name> (edited)", for a document to keep and change. */
export function forkTheme(theme: DiagramTheme): DiagramTheme {
  return { ...structuredClone(theme), id: `${theme.id}-edited`, name: `${theme.name} (edited)` };
}

/** `theme` when it is already a custom theme, else a fork of it: what the first edit to a shipped
 *  theme starts from. */
export const editableTheme = (theme: DiagramTheme): DiagramTheme => (isShippedTheme(theme) ? forkTheme(theme) : theme);

/** The value at `path` in `theme`. */
export function themeValue(theme: DiagramTheme, path: ThemePath): unknown {
  let at: unknown = theme;
  for (const key of path) at = (at as Record<string | number, unknown> | undefined)?.[key];
  return at;
}

function setIn(at: unknown, path: readonly (string | number)[], value: unknown): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  if (Array.isArray(at)) {
    const copy = [...at];
    copy[key as number] = setIn(copy[key as number], rest, value);
    return copy;
  }
  const obj = (at ?? {}) as Record<string, unknown>;
  return { ...obj, [key!]: setIn(obj[key!], rest, value) };
}

/** `theme` with `value` at `path`; everything else shared with it. */
export const setThemeValue = (theme: DiagramTheme, path: ThemePath, value: string | number): DiagramTheme =>
  setIn(theme, path, value) as DiagramTheme;

/** Every role `theme` styles with the name a picker shows: the shipped roles first, in their order,
 *  then the theme's own. */
export function themeRoles(theme: DiagramTheme): { id: string; label: string }[] {
  const shipped = new Map<string, string>(DIAGRAM_ROLES.map((r) => [r.id, r.label]));
  const ids = [...DIAGRAM_ROLES.map((r) => r.id as string).filter((id) => id in theme.roles),
    ...Object.keys(theme.roles).filter((id) => !shipped.has(id))];
  return ids.map((id) => ({ id, label: theme.roleLabels?.[id] ?? shipped.get(id) ?? id }));
}

const slug = (label: string): string => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'role';

/** `theme` with a role named `label`, in the default role's colors, and the id it was given. */
export function addThemeRole(theme: DiagramTheme, label: string): { theme: DiagramTheme; id: string } {
  const base = slug(label);
  let id = base;
  for (let n = 2; id in theme.roles; n++) id = `${base}-${n}`;
  return {
    theme: { ...theme, roles: { ...theme.roles, [id]: { ...theme.roles[theme.defaultRole]! } }, roleLabels: { ...theme.roleLabels, [id]: label } },
    id,
  };
}

/** `theme` with role `id` shown as `label`. The id, which shapes name the role by, stays. */
export const renameThemeRole = (theme: DiagramTheme, id: string, label: string): DiagramTheme =>
  (id in theme.roles ? { ...theme, roleLabels: { ...theme.roleLabels, [id]: label } } : theme);

/** `theme` without role `id`; its shapes fall to the default role when the theme is next applied.
 *  The default role stays: `theme` comes back unchanged. */
export function removeThemeRole(theme: DiagramTheme, id: string): DiagramTheme {
  if (id === theme.defaultRole || !(id in theme.roles)) return theme;
  const { [id]: _, ...roles } = theme.roles;
  const { [id]: __, ...labels } = theme.roleLabels ?? {};
  return { ...theme, roles, ...(theme.roleLabels ? { roleLabels: labels } : {}) };
}
