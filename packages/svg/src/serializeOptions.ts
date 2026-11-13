import type { TextPoseLayout } from '@weasel-js/core';
import type { NamespaceMeta, SvgTextNode } from './types';

/**
 * How {@link serializeSvg} writes a text node. `'live'` is a `<text>` element
 * naming its `font-family`, which another renderer sets in whatever face it
 * has. `'outline'` is the glyphs as filled paths, one per paint, exactly as
 * the canvas sets them; the text is no longer text. `'embed'` keeps `<text>`
 * and carries each face it is set in as an `@font-face` rule holding the
 * font file, so a reader sets it in that face; a node set in a face whose
 * license forbids embedding, or that has no font file behind it, is written
 * as outlines instead, with a warning naming the face.
 */
export type SvgTextMode = 'live' | 'outline' | 'embed';

/** Options for {@link serializeSvg}. */
export interface SerializeOptions {
  /**
   * How text is written; see {@link SvgTextMode}. Default `'live'`.
   * `'outline'` and `'embed'` read the outlines of every face the text is set
   * in, which `warmSvg(nodes, { text })` loads; a node whose outlines have not
   * loaded is written as live text, with a warning.
   */
  text?: SvgTextMode;
  /** The root `viewBox`. Default: a tight bounding box around the nodes. */
  viewBox?: { x: number; y: number; width: number; height: number };
  /**
   * Called for what the document cannot carry the way weasel draws it: a
   * paint SVG cannot express (a pattern carrying a `TextureHandle` instead of
   * a `TilePatternSpec`), a stroke aligned off its edge, text that wraps or
   * sits lower than the top of its box. Each message is said once per call.
   * Without this the loss is silent.
   */
  onWarn?: (message: string) => void;
  /** Emit `width="..."` on the root `<svg>`. */
  width?: number;
  /** Emit `height="..."` on the root `<svg>`. */
  height?: number;
  /** Emit `<title>` as the first child of the root `<svg>`. Empty strings are skipped. */
  title?: string;
  /**
   * Map of prefix → URI for XML namespaces to declare on the root `<svg>`.
   * Only `documentMeta` and `node.meta` entries under a declared prefix are written.
   */
  namespaces?: Record<string, string>;
  /**
   * Per-document namespaced extras: `attrs` go on the root `<svg>`, and
   * `elements` become children placed immediately before any geometry.
   */
  documentMeta?: NamespaceMeta;
  /**
   * Put each element on its own line, indented two spaces per level. A
   * `<text>` element, and any element holding character data, stays on one
   * line, since whitespace inside it is content.
   */
  pretty?: boolean;
  /**
   * The lines a text node lays out into — pass core's `layoutTextPose`, the
   * layout the renderer draws with. With it, each line is written as a
   * `<tspan>` at the layout's own `x` and baseline `y`, a justified line
   * gives each word its own `x`, and a line holding a larger run is pitched
   * as the renderer pitches it, so a reader that cannot wrap draws the lines
   * where weasel does. A node it returns nothing for, or lays out to zero
   * width because no face could measure it, is written without it: one line
   * per hard break, at the node's own pitch. Fonts it reads must have loaded;
   * `warmSvg(nodes, { textLayout })` loads them.
   */
  textLayout?: (node: SvgTextNode) => TextPoseLayout | null | undefined;
}
