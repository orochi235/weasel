import type { DrawCommand, SceneNode, View } from '@weasel-js/core';
import type { WorldRect } from './frac';
import { markCommands } from './paint';
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
  const keys = opts.positionDependsOn ?? [];
  const colorOf = (status: string | undefined): string | undefined =>
    opts.meaning?.statuses?.find((s) => s.id === status)?.color;

  return (node, pose) =>
    markCommands({ pose, data: node.data }, opts.content, {
      color: colorOf(node.data.status),
      // Read off the node rather than through the store's `isStale`, which
      // wants a projected Annotation this path does not have.
      stale: isStale(node.data.seen, opts.config, keys),
    });
}
