import type { RefObject } from 'react';
import type { ViewTransform } from '../instrument/types';

/** A point in fractions of a target's content box. */
export interface FracPoint {
  x: number;
  y: number;
}

/** A rectangle in fractions of a target's content box.
 *
 *  Fractions rather than pixels because a mark must survive a change of render
 *  resolution: the picture gets bigger, the mark stays on the same feature. */
export interface FracRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What shape a mark is. The kinds map onto weasel's own tools; an arrow is a
 *  line carrying an end marker, not a separate geometry. */
export type AnnotationKind = 'stroke' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';

/** One selectable status in an instrument's meaning tier. */
export interface AnnotationStatus {
  id: string;
  label: string;
}

/** The optional meaning tier: what a mark means, as opposed to where it is.
 *  An instrument declaring it gets labkit's own chrome for the vocabulary;
 *  one that omits it keeps `meta` and owns meaning entirely. */
export interface AnnotationMeaning {
  statuses?: readonly AnnotationStatus[];
}

/** What labkit keeps in a mark's scene-node data. */
export interface AnnotationData {
  target: string;
  kind: AnnotationKind;
  /** Vertices for the kinds a bounding box cannot describe — a line's two
   *  ends, a stroke's path. In fractions, like the bounds. */
  points?: readonly FracPoint[];
  title?: string;
  status?: string;
  tags?: readonly string[];
  meta?: unknown;
  /** The target's `positionDependsOn` values when the mark was made. Compared
   *  against the live config to answer whether the mark still describes the
   *  same picture. */
  seen?: Readonly<Record<string, unknown>>;
}

/** A mark, as the store reports it. */
export interface Annotation extends AnnotationData {
  id: string;
  /** Bounds in fractions of the target's content box. */
  frac: FracRect;
}

/** A new mark, before the store gives it an id and dates it. */
export interface AnnotationInit {
  target: string;
  kind: AnnotationKind;
  frac: FracRect;
  points?: readonly FracPoint[];
  title?: string;
  status?: string;
  tags?: readonly string[];
  meta?: unknown;
}

/** Filters, ANDed. A mark matches `tags` when it carries every tag listed. */
export interface AnnotationQuery {
  target?: string;
  kind?: AnnotationKind;
  status?: string;
  tags?: readonly string[];
  where?: (a: Annotation) => boolean;
}

/** What a mark's meaning can be patched to. Geometry moves through `frac` /
 *  `points`; everything else is the meaning tier. */
export type AnnotationPatch = Partial<
  Pick<Annotation, 'frac' | 'points' | 'title' | 'status' | 'tags' | 'meta'>
>;

/** What the store needs to know about a target: enough to convert a position
 *  and to date a mark. `AnnotationTarget` adds what only the overlay reads. */
export interface AnnotationTargetInfo {
  id: string;
  /** Intrinsic content size in CSS pixels at zoom 1 — the box fractions are
   *  fractions *of*, and the target's world. */
  content: { w: number; h: number };
  /** Config keys whose change means a stored position no longer refers to the
   *  same picture. labkit snapshots and compares them without knowing what any
   *  of them mean. */
  positionDependsOn?: readonly string[];
}

/** One region of an instrument that accepts marks. */
export interface AnnotationTarget extends AnnotationTargetInfo {
  /** The element the overlay tracks and takes input from. */
  ref: RefObject<HTMLElement | null>;
  /** The pane's camera, mirrored so marks pan and zoom with what they mark. */
  view?: ViewTransform;
}

/** Declares that an instrument accepts marks: which regions take them, and
 *  optionally what a mark is allowed to mean. */
export interface AnnotationsCapability<TS = unknown, TC = unknown> {
  targets: (state: TS, config: TC) => readonly AnnotationTarget[];
  meaning?: AnnotationMeaning;
}

/** A persisted mark set. Versioned by this arc rather than by labkit's
 *  document migrations, which only ever reach top-level document sections and
 *  never into a trial's state. */
export interface SerializedAnnotations {
  version: 1;
  scene: unknown;
}

/** Everything a host can ask or tell labkit about the marks on its targets. */
export interface AnnotationsApi {
  get(id: string): Annotation | undefined;
  /** Every mark matching the filters, in scene order. Omit `q` for all. */
  query(q?: AnnotationQuery): Annotation[];
  /** Marks whose bounds contain `pt`, topmost first. `tol` widens the hit in
   *  fractions, so a hairline mark stays reachable. */
  hitTest(target: string, pt: FracPoint, tol?: number): Annotation[];
  /** Marks wholly inside `box` — a marquee, not a brush. */
  within(target: string, box: FracRect): Annotation[];
  /** Whether `a`'s position still describes the picture `config` produces. */
  isStale(a: Annotation, config: unknown): boolean;
  /** Fires after every mutation. No delta: the scene does not diff, so
   *  re-query rather than expecting a change payload. */
  subscribe(fn: () => void): () => void;

  add(init: AnnotationInit, config?: unknown): string;
  update(id: string, patch: AnnotationPatch): void;
  setMeta(id: string, meta: unknown): void;
  remove(id: string): void;

  /** A JSON-safe snapshot for `record.state`. */
  toJSON(): SerializedAnnotations;
}
