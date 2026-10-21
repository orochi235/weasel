import type { EdgeStyle, NodeStyle } from '../fromData';

/** The roles every shipped theme styles, with the name a picker shows. */
export const DIAGRAM_ROLES = [
  { id: 'default', label: 'Default' },
  { id: 'accent', label: 'Accent' },
  { id: 'muted', label: 'Muted' },
  { id: 'positive', label: 'Positive' },
  { id: 'warning', label: 'Warning' },
  { id: 'negative', label: 'Negative' },
] as const;

/** The id of one of {@link DIAGRAM_ROLES}. A theme may style roles of its own besides. */
export type DiagramRole = (typeof DIAGRAM_ROLES)[number]['id'];

export type { FontField, StyleField } from './styleField';

/** The face a theme sets diagram text in. A text row keeps its own size. */
export interface DiagramFont {
  family: string;
  size: number;
}

/**
 * A document's colors and face. Applying one writes literal colors into the
 * scene, so nothing that reads the scene needs the theme to draw it.
 */
export interface DiagramTheme {
  id: string;
  name: string;
  /** A shape's fill, stroke and text by role id. A connector given a role takes that role's stroke. */
  roles: Readonly<Record<string, NodeStyle>>;
  /** The names a picker shows for roles beyond {@link DIAGRAM_ROLES}, or for a shipped role renamed. */
  roleLabels?: Readonly<Record<string, string>>;
  /** The role a shape or connector naming none, or naming one this theme lacks, is drawn in. */
  defaultRole: string;
  /** A connector naming no role. */
  edge: EdgeStyle;
  /** A connector's label, where the connector names no role. */
  label: { fill: string; font?: DiagramFont };
  /** A group's or a container's box, its `text` the title's color. */
  container: NodeStyle;
  /** A pool's header, and its lanes' bodies in turn. */
  lane: { header: NodeStyle; bodies: readonly NodeStyle[] };
  /** The page a document is drawn on. */
  page: string;
  font: DiagramFont;
  /** Colors for a series of things the theme cannot name in advance: an effect look's value types. */
  series: readonly string[];
}

/** The document value a theme is saved under: a shipped theme's id, or a whole custom theme. */
export const DIAGRAM_THEME_KEY = 'diagram:theme';
