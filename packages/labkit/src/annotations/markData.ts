import type { AnnotationData, AnnotationInit, FracPoint } from './types';

/** The fields a new mark carries over from its init only when they are set. */
const OPTIONAL = ['title', 'status', 'tags', 'meta', 'width', 'color', 'fontSize'] as const;

/** A new mark's scene-node data: its init's fields, its vertices against its bounds, and what it was made seeing. */
export function markDataFrom(
  init: AnnotationInit,
  shape: readonly FracPoint[] | undefined,
  seen: AnnotationData['seen'],
): AnnotationData {
  const data: Record<string, unknown> = { target: init.target, kind: init.kind };
  if (shape) data.shape = shape;
  for (const key of OPTIONAL) if (init[key] !== undefined) data[key] = init[key];
  data.seen = seen;
  return data as unknown as AnnotationData;
}
