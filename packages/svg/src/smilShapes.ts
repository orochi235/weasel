/**
 * What a clip binder needs to know about an element SMIL animates, kept while the document is
 * read: parsing collapses transforms and paint opacities into what each leaf stores, so the facts
 * a sampled value is lowered against are only to be had then.
 */
import type { ShapeGeometry } from './lowerLeaf';
import { ownValue, setsOwn } from './cascade';
import type { AnimatedShape, AnimatedTransform, Matrix, SvgAnimatedFrom, SvgAnimatedPaint } from './types';

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

/** Records shape `el` if it is watched: its geometry, and the matrix that geometry went through. */
export function noteShape(el: Element, tag: string, geometry: () => ShapeGeometry, matrix: Matrix): void {
  const watch = watches.get(el.ownerDocument);
  if (!watch?.elements.has(el) || !el.id) return;
  watch.shapes[el.id] = { tag, geometry: geometry(), matrix };
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

const PAINTS: readonly SvgAnimatedPaint[] = ['fill', 'stroke', 'fill-opacity', 'stroke-opacity'];

/** For each paint property, the animated element `el` takes it from: itself, or the nearest
 *  element above it that sets it, where that one's is animated. Undefined where none is. */
export function animatedFromOf(el: Element): SvgAnimatedFrom | undefined {
  const watch = watches.get(el.ownerDocument);
  if (!watch) return undefined;
  let out: SvgAnimatedFrom | undefined;
  for (const prop of PAINTS) {
    for (let at: Element | null = el; at; at = at.parentElement) {
      const animated = watch.elements.get(at)?.has(prop) === true;
      if (!animated && !setsOwn(at, prop)) continue;
      if (animated && at.id) {
        const value = prop === 'fill' || prop === 'stroke' ? 1 : ownValue(at, prop) ?? 1;
        (out ??= {})[prop] = { id: at.id, value };
      }
      break;
    }
  }
  return out;
}
