import type { DrawCommand, SceneNode, View } from '@weasel-js/core';
import type { WorldRect } from './frac';
import { type MarkStyle, markCommands } from './paint';
import { isStale } from './staleness';
import type { AnnotationData, AnnotationMeaning } from './types';

/** What resolving a mark's appearance needs beyond the mark itself. */
export interface MarkDrawOptions {
  /** The target's content box — the world a mark's geometry is in. */
  content: { w: number; h: number };
  /** The target's `positionDependsOn`, for staleness. */
  positionDependsOn?: readonly string[];
  /** The trial's config at the time of the draw. */
  config: unknown;
  /** The instrument's vocabulary, for a status's colour. */
  meaning?: AnnotationMeaning;
}

/**
 * How one mark is drawn — shared by the pane on screen and by an export.
 *
 * One function rather than two call sites building their own, because an
 * export that resolves a status colour or a stale dash differently from the
 * screen produces a picture nobody was looking at.
 */
export function createMarkDrawOne(
  opts: MarkDrawOptions,
): (
  node: SceneNode<AnnotationData, 'marks', WorldRect>,
  pose: WorldRect,
  view: View,
) => DrawCommand[] {
  return (node, pose) =>
    markCommands({ pose, data: node.data }, opts.content, resolveMarkStyle(node.data, opts));
}

/** How a mark looks, as opposed to where it is. Separate from the callback
 *  above because an SVG export resolves the same appearance without ever
 *  building a draw command. */
export function resolveMarkStyle(data: AnnotationData, opts: MarkDrawOptions): MarkStyle {
  return {
    color: opts.meaning?.statuses?.find((s) => s.id === data.status)?.color,
    // Read off the node rather than through the store's `isStale`, which
    // wants a projected Annotation this path does not have.
    stale: isStale(data.seen, opts.config, opts.positionDependsOn ?? []),
  };
}
