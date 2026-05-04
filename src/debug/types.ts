/** One bit per debug feature; absent keys are off. */
export interface DebugConfig {
  hitboxes?: boolean;
  handles?: boolean;
  bounds?: boolean;
  origins?: boolean;
  snap?: boolean;
  layers?: boolean;
  /** Optional per-feature color overrides; falls back to the default theme. */
  theme?: Partial<DebugTheme>;
}

export type DebugFeature = 'hitboxes' | 'handles' | 'bounds' | 'origins' | 'snap' | 'layers';

export interface DebugTheme {
  hitboxFill: string;
  hitboxStroke: string;
  handle: string;
  bounds: string;
  origin: string;
  snap: string;
  layerText: string;
  layerTextBg: string;
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
