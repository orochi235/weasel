/**
 * `DebugSink`, `HitShape` and `HandleKind` are declared in
 * `@weasel-js/routing` — `ToolCtx.debug` carries a sink, so routing has to
 * name the type. Re-exported here, beside the overlay that reads one.
 */
import type { DebugSink, HitShape, HandleKind } from '@weasel-js/routing';
export type { DebugSink, HitShape, HandleKind };

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

/** The name of one debug-overlay feature — the keys of {@link DebugConfig}
 *  that toggle a visualization. */
export type DebugFeature = 'hitboxes' | 'handles' | 'bounds' | 'origins' | 'snap' | 'layers' | 'ids' | 'fps';

/** Colors the debug overlay draws with, one entry per feature. */
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



/** A hit region tested during the current frame. */
export interface RecordedHitbox {
  id: string;
  kind: 'body' | 'handle' | 'rotation' | 'anchor';
  shape: HitShape;
}

/** A handle drawn during the current frame, and where. */
export interface RecordedHandle {
  id: string;
  position: { x: number; y: number };
  kind: HandleKind;
}

/** A node's bounds as computed during the current frame. */
export interface RecordedBounds {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
}

/** A node's transform origin as used during the current frame. */
export interface RecordedOrigin {
  id: string;
  point: { x: number; y: number };
}

/** A snap candidate considered during the current gesture, and whether it
 *  won. Unlike the other records these survive across frames, until the
 *  gesture ends. */
export interface RecordedSnap {
  point: { x: number; y: number };
  accepted: boolean;
}

/** A render layer that drew during the current frame. */
export interface RecordedLayer {
  id: string;
  label: string;
  space: 'world' | 'screen';
  index: number;
}

/** Everything the sink collected, ready for the overlay to draw. */
export interface DebugSnapshot {
  hitboxes: RecordedHitbox[];
  handles: RecordedHandle[];
  bounds: RecordedBounds[];
  origins: RecordedOrigin[];
  snap: RecordedSnap[];
  layers: RecordedLayer[];
}

/**
 * Where the kit reports what it is doing so the debug overlay can draw it.
 *
 * Recording is push-based and cheap: hit-testers, handle painters and snap
 * strategies call these as they run, whether or not any overlay is watching.
 * Nothing here affects behavior — a sink that discards everything is a valid
 * sink.
 */
