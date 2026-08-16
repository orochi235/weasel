/** One bit per debug feature; absent keys are off. */
export interface DebugConfig {
  hitboxes?: boolean;
  handles?: boolean;
  bounds?: boolean;
  origins?: boolean;
  snap?: boolean;
  layers?: boolean;
  /** Render each tracked node's id as a label at the top-left of its
   *  bounds. Pulls from the same `recordBounds` stream `bounds` uses, so
   *  no extra sink calls are required to enable. */
  ids?: boolean;
  /** Rolling FPS counter rendered in the top-left corner of the canvas.
   *  Tracks the rate at which the debug overlay's draw callback runs;
   *  this matches the canvas's effective repaint rate. */
  fps?: boolean;
  /** Optional per-feature color overrides; falls back to the default theme. */
  theme?: Partial<DebugTheme>;
  /** Optional per-feature line-width / dash overrides; falls back to
   *  {@link DEFAULT_DEBUG_STROKES}. */
  strokes?: Partial<DebugStrokes>;
}

export type DebugFeature = 'hitboxes' | 'handles' | 'bounds' | 'origins' | 'snap' | 'layers' | 'ids' | 'fps';

export interface DebugTheme {
  hitboxFill: string;
  hitboxStroke: string;
  handle: string;
  bounds: string;
  origin: string;
  snap: string;
  layerText: string;
  layerTextBg: string;
  /** Color for the per-node id label rendered when `config.ids` is on. */
  idText: string;
  /** Foreground / background for the FPS panel. */
  fpsText: string;
  fpsTextBg: string;
}

/** Line width and dash pattern for one stroked debug feature. An empty (or
 *  omitted) `dash` is a solid line. */
export interface DebugStroke {
  width: number;
  dash?: readonly number[];
}

/** The stroked half of the debug overlay's appearance, split from
 *  {@link DebugTheme} because only some features draw a line at all — text
 *  panels and filled origin dots take color and nothing else. */
export interface DebugStrokes {
  hitbox: DebugStroke;
  bounds: DebugStroke;
  handle: DebugStroke;
  /** Rejected snap candidates only; accepted ones paint as a filled dot. */
  snap: DebugStroke;
}

export type HandleKind = 'corner' | 'rotation' | 'anchor';

export type HitShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rotation?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; d: Path2D };

export interface RecordedHitbox {
  id: string;
  kind: 'body' | 'handle' | 'rotation' | 'anchor';
  shape: HitShape;
}

export interface RecordedHandle {
  id: string;
  position: { x: number; y: number };
  kind: HandleKind;
}

export interface RecordedBounds {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface RecordedOrigin {
  id: string;
  point: { x: number; y: number };
}

export interface RecordedSnap {
  point: { x: number; y: number };
  accepted: boolean;
}

export interface RecordedLayer {
  id: string;
  label: string;
  space: 'world' | 'screen';
  index: number;
}

export interface DebugSnapshot {
  hitboxes: RecordedHitbox[];
  handles: RecordedHandle[];
  bounds: RecordedBounds[];
  origins: RecordedOrigin[];
  snap: RecordedSnap[];
  layers: RecordedLayer[];
}

export interface DebugSink {
  recordHitbox(id: string, kind: 'body' | 'handle' | 'rotation' | 'anchor', shape: HitShape): void;
  recordHandle(id: string, position: { x: number; y: number }, kind: HandleKind): void;
  recordBounds(id: string, bounds: { x: number; y: number; width: number; height: number }): void;
  recordOrigin(id: string, point: { x: number; y: number }): void;
  recordSnapCandidate(point: { x: number; y: number }, accepted: boolean): void;
  recordLayer(id: string, label: string, space: 'world' | 'screen', index: number): void;
  /** Clears every non-snap array. Called at the start of each Canvas render. */
  beginFrame(): void;
  /** Clears the snap array. Called at gesture end. */
  clearSnap(): void;
}
