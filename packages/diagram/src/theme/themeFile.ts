/**
 * A theme as a file, so a custom theme can travel between documents: written
 * as JSON, and checked on the way back in.
 */
import { parseColor } from '@weasel-js/core';
import type { DiagramTheme } from './types';

/** The extension a theme file is saved with. */
export const DIAGRAM_THEME_EXTENSION = '.weasel-theme.json';

/** `theme` as the text of a theme file. */
export const themeToJson = (theme: DiagramTheme): string => `${JSON.stringify(theme, null, 2)}\n`;

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => v !== null && typeof v === 'object' && !Array.isArray(v);

function isColor(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  try {
    parseColor(v);
    return true;
  } catch {
    return false;
  }
}

/** The checks one theme gets, each adding what it finds wrong to `errors`, named by its path. */
function checker(errors: string[]) {
  const color = (path: string, v: unknown) => { if (!isColor(v)) errors.push(`${path}: ${JSON.stringify(v)} is not a color`); };
  const box = (path: string, v: unknown) => {
    if (!isObject(v)) return void errors.push(`${path}: missing`);
    for (const field of ['fill', 'stroke', 'text']) color(`${path}.${field}`, v[field]);
  };
  const text = (path: string, v: unknown) => { if (typeof v !== 'string' || v === '') errors.push(`${path}: missing`); };
  const font = (path: string, v: unknown) => {
    if (!isObject(v)) return void errors.push(`${path}: missing`);
    text(`${path}.family`, v.family);
    if (typeof v.size !== 'number' || !(v.size > 0)) errors.push(`${path}.size: ${JSON.stringify(v.size)} is not a size`);
  };
  return { color, box, text, font };
}

function checkTheme(t: Raw, errors: string[]): void {
  const { color, box, text, font } = checker(errors);
  text('id', t.id);
  text('name', t.name);
  if (!isObject(t.roles) || Object.keys(t.roles).length === 0) errors.push('roles: missing');
  else for (const [id, style] of Object.entries(t.roles)) box(`roles.${id}`, style);
  if (typeof t.defaultRole !== 'string') errors.push('defaultRole: missing');
  else if (isObject(t.roles) && !(t.defaultRole in t.roles)) errors.push(`defaultRole: no role ${JSON.stringify(t.defaultRole)}`);
  if (t.roleLabels !== undefined) {
    if (!isObject(t.roleLabels)) errors.push('roleLabels: not an object');
    else for (const [id, label] of Object.entries(t.roleLabels)) text(`roleLabels.${id}`, label);
  }
  if (!isObject(t.edge)) errors.push('edge: missing');
  else color('edge.stroke', t.edge.stroke);
  if (!isObject(t.label)) errors.push('label: missing');
  else {
    color('label.fill', t.label.fill);
    if (t.label.font !== undefined) font('label.font', t.label.font);
  }
  box('container', t.container);
  if (!isObject(t.lane)) errors.push('lane: missing');
  else {
    box('lane.header', t.lane.header);
    if (!Array.isArray(t.lane.bodies) || t.lane.bodies.length === 0) errors.push('lane.bodies: missing');
    else t.lane.bodies.forEach((b, i) => box(`lane.bodies.${i}`, b));
  }
  color('page', t.page);
  font('font', t.font);
  if (!Array.isArray(t.series)) errors.push('series: missing');
  else t.series.forEach((c, i) => color(`series.${i}`, c));
}

/** The theme a theme file holds, or what is wrong with it, each error naming where. */
export function parseDiagramTheme(json: string): { theme: DiagramTheme } | { errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return { errors: [`not JSON: ${(err as Error).message}`] };
  }
  if (!isObject(raw)) return { errors: ['a theme is an object'] };
  const errors: string[] = [];
  checkTheme(raw, errors);
  return errors.length > 0 ? { errors } : { theme: raw as unknown as DiagramTheme };
}
