/**
 * What a clip binder needs to know about an element SMIL animates, kept while the document is
 * read: parsing collapses transforms and paint opacities into what each leaf stores, so the facts
 * a sampled value is lowered against are only to be had then.
 */
import type { ShapeGeometry } from './lowerLeaf';
import type { AnimatedShape, AnimatedTransform, Matrix } from './types';

interface Watch {
  /** Each animated element, with the attributes animated on it (`transform` for an `<animateTransform>`). */
  readonly elements: ReadonlyMap<Element, ReadonlySet<string>>;
  readonly shapes: Record<string, AnimatedShape>;
  readonly transforms: Record<string, AnimatedTransform>;
}

const watches = new WeakMap<Document, Watch>();

/** Records the elements of `elements` as `noteShape` and `noteTransform` reach them in `doc`. */
export function watchShapes(doc: Document, elements: ReadonlyMap<Element, ReadonlySet<string>>): void {
  if (elements.size > 0) watches.set(doc, { elements, shapes: {}, transforms: {} });
}

/** Whether `el`'s `transform` is animated, so the parse keeps it apart from its geometry's rotation. */
export function isTransformAnimated(el: Element): boolean {
  return watches.get(el.ownerDocument)?.elements.get(el)?.has('transform') === true;
}

/** Records shape `el` if it is watched: its geometry, the matrix that geometry went through, and its own paint opacities. */
export function noteShape(el: Element, tag: string, geometry: () => ShapeGeometry, matrix: Matrix, opacities: { fill: number; stroke: number }): void {
  const watch = watches.get(el.ownerDocument);
  if (!watch?.elements.has(el) || !el.id) return;
  watch.shapes[el.id] = { tag, geometry: geometry(), matrix, fillOpacity: opacities.fill, strokeOpacity: opacities.stroke };
}

/** Records `el`'s transform if it is animated: the matrix above it, and its own. */
export function noteTransform(el: Element, above: Matrix, own: Matrix): void {
  const watch = watches.get(el.ownerDocument);
  if (!el.id || !watch?.elements.get(el)?.has('transform')) return;
  watch.transforms[el.id] = { above, own };
}

/** What was recorded in `doc`, which stops watching it. */
export function takeShapes(doc: Document): { shapes?: Readonly<Record<string, AnimatedShape>>; transforms?: Readonly<Record<string, AnimatedTransform>> } {
  const watch = watches.get(doc);
  watches.delete(doc);
  if (!watch) return {};
  return {
    ...(Object.keys(watch.shapes).length > 0 ? { shapes: watch.shapes } : {}),
    ...(Object.keys(watch.transforms).length > 0 ? { transforms: watch.transforms } : {}),
  };
}
