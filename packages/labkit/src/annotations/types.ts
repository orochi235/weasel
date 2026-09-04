import type { RefObject } from 'react';
import type { ViewTransform } from '../instrument/types';
import type { MarkScene } from './store';

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
  /** What a mark in this status is drawn in. Omitted, it takes the default
   *  mark colour — a status is allowed to be a label and nothing more. */
  color?: string;
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

/** A mark, as the store reports it. `id` is `<target>/<node>`: one scene per
 *  target means a node id is only unique within one. */
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

/** A target's own picture, handed over for an export to draw marks on top of.
 *  labkit cannot rasterize it: it is the consumer's DOM. `svg` is the one that
 *  keeps the export vector all the way through. */
export type CaptureSource =
  | { kind: 'svg'; markup: string }
  | { kind: 'image'; src: string }
  | { kind: 'canvas'; canvas: HTMLCanvasElement };

/** What an export produces, and at what resolution. */
export interface CaptureOptions {
  /** `png` rasterizes; `svg` stays vector, which needs the base to be one too
   *  — a raster base embeds as an `<image>`. Default `png`. */
  format?: 'png' | 'svg';
  /** Output pixels per unit of the target's content box. Default 2. */
  scale?: number;
}

/** A finished export. `width`/`height` are the output's, not the content
 *  box's — `content × scale`. */
export interface CaptureResult {
  target: string;
  blob: Blob;
  format: 'png' | 'svg';
  width: number;
  height: number;
}

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
  /** The target's own picture, for an export to draw marks over. A target
   *  declaring none exports its marks on transparency, which fails visibly
   *  rather than producing a blank brick.
   *
   *  Here rather than on `AnnotationTarget` because the store is what calls
   *  it: `ref` and `view` are the React-shaped half only the overlay reads. */
  base?: () => CaptureSource | Promise<CaptureSource>;
}

/** One region of an instrument that accepts marks. */
export interface AnnotationTarget extends AnnotationTargetInfo {
  /** The element the overlay tracks and takes input from. */
  ref: RefObject<HTMLElement | null>;
  /** The pane's camera, mirrored so marks pan and zoom with what they mark. */
  view?: ViewTransform;
}

/** Where an instrument keeps its own marks. Declaring this means labkit never
 *  writes its trial slot — for an instrument whose marks belong in a format it
 *  already owns. Both halves are called outside React; `save` is already
 *  debounced by the time it arrives. */
export interface AnnotationStorage {
  load: () => SerializedAnnotations | null | undefined;
  save: (doc: SerializedAnnotations) => void;
}

/** Declares that an instrument accepts marks: which regions take them,
 *  optionally what a mark is allowed to mean, and optionally where they live. */
export interface AnnotationsCapability<TS = unknown, TC = unknown> {
  targets: (state: TS, config: TC) => readonly AnnotationTarget[];
  meaning?: AnnotationMeaning;
  storage?: AnnotationStorage;
  /** Fires after every finished export, labkit's own chrome included. A
   *  notification, not an interception: a host wanting its own flow calls
   *  `capture()` from its own UI, which is the surface the chrome uses. */
  onCapture?: (result: CaptureResult) => void;
}

/** A persisted mark set. Versioned by this arc rather than by labkit's
 *  document migrations, which only ever reach top-level document sections and
 *  never into a trial's state. */
export interface SerializedAnnotations {
  version: 1;
  /** One serialized scene per target that has ever held a mark. */
  scenes: Record<string, unknown>;
}

/** Everything a host can ask or tell labkit about the marks on its targets. */
export interface AnnotationsApi {
  /** The scene a target's marks live in, created on first ask. One per target
   *  because a pane's hit-test, marquee and paint walk the whole scene they
   *  are given: a shared one would put a neighbour's marks under the pointer. */
  sceneFor(target: string): MarkScene;
  /** The targets the instrument declares, in declaration order. Chrome needs
   *  the list and cannot get it from the capability, which wants instrument
   *  state the chrome context does not carry. */
  targets(): readonly AnnotationTargetInfo[];
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
  /** The marks the user currently has selected, across every target, as
   *  annotation ids. Every one resolves through `get`. */
  selection(): readonly string[];
  /** Replace the selection. An id naming a target or a mark that is not
   *  there is dropped, the way `update` and `remove` ignore one. */
  setSelection(ids: readonly string[]): void;
  /** Fires after every mutation *and* after a selection change — weasel keeps
   *  a canvas's selection on the scene, so both already arrive on this one
   *  channel. No delta: re-query, and re-read `selection()`. */
  subscribe(fn: () => void): () => void;

  /** Whether the last mark change on any target can be taken back. Weasel
   *  history is the authority; this only decides *which* target's. */
  canUndo(): boolean;
  canRedo(): boolean;
  /** Take back the most recent mark change, wherever it was made. */
  undo(): boolean;
  redo(): boolean;

  /** Export a target's picture with its marks on it. Rejects on an id the
   *  instrument does not declare. */
  capture(target: string, opts?: CaptureOptions): Promise<CaptureResult>;

  add(init: AnnotationInit, config?: unknown): string;
  update(id: string, patch: AnnotationPatch): void;
  setMeta(id: string, meta: unknown): void;
  remove(id: string): void;

  /** A JSON-safe snapshot for `record.state`. */
  toJSON(): SerializedAnnotations;
}
