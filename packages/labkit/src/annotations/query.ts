import type { Annotation, AnnotationQuery } from './types';

/** Whether mark `a` is one query `q` asks for. */
export function matchesQuery(a: Annotation, q: AnnotationQuery): boolean {
  if (q.target !== undefined && a.target !== q.target) return false;
  if (q.kind !== undefined && a.kind !== q.kind) return false;
  if (q.status !== undefined && a.status !== q.status) return false;
  if (q.tags !== undefined) {
    const have = a.tags ?? [];
    for (const t of q.tags) if (!have.includes(t)) return false;
  }
  if (q.where && !q.where(a)) return false;
  return true;
}
