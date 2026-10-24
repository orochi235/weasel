/**
 * `documentOf` — a scene read as its document holds it.
 *
 * Commands and exports act on the document: Expand bakes what an effect's
 * sources store, an SVG save writes it, Align measures it. Handed the scene
 * itself, every reader they reach — `effectivePose`, `derivedDepOf`, the
 * canvas's derived paths and drawn bounds — would bake in whatever a gesture or
 * an open text edit is showing. Handed `documentOf(scene)`, each of them reads
 * the document, because the view it is handed holds no overrides.
 */
import type { NodeId, PoseHold, PoseOverride, PoseOverrides } from './types';

const refuse = (): never => {
  throw new Error('documentOf: the document reading holds no overrides; write them to the scene');
};

/** The empty table a document reading answers with. */
const DOCUMENT_OVERRIDES: PoseOverrides<never, never> = Object.freeze({
  set: refuse,
  get: (): undefined => undefined,
  read: (_id: NodeId): PoseOverride<never, never> | undefined => undefined,
  has: () => false,
  ids: () => [],
  clear: refuse,
  clearAll: refuse,
  commit: refuse,
  subscribe: () => () => {},
  getGeneration: () => 0,
  hold: (): PoseHold<never, never> => refuse(),
});

const views = new WeakMap<object, object>();

/**
 * `source` read as its document holds it: the same object in every respect but
 * its `overrides`, which are empty, so no pose, path or data override reaches
 * anything handed it. One view per source, so memos keyed on it hit. The
 * readers it is handed to memoize the document reading apart from the shown
 * one, as `documentPose` and `documentDepOf` do.
 */
export function documentOf<TSource extends { readonly overrides: unknown }>(source: TSource): TSource {
  if (isDocument(source)) return source;
  let view = views.get(source);
  if (view === undefined) {
    view = Object.create(source, { overrides: { value: DOCUMENT_OVERRIDES } }) as object;
    views.set(source, view);
  }
  return view as TSource;
}

/** Whether `source` is a {@link documentOf} view. */
export function isDocument(source: { readonly overrides: unknown }): boolean {
  return source.overrides === DOCUMENT_OVERRIDES;
}
