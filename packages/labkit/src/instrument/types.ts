import type { ReactNode } from 'react';
import type { TrialContribution } from '../chrome/types';
import type { ConfigSchema } from '../config/types';
import type { ConfigField } from '../controls/types';
import type { JobCapability, JobHandle } from '../job/types';
import type { ToolCapability } from '../tools/types';

/** What an instrument's `render` is handed: its state and config, the setters
 *  for both, the trial it is mounted in, and a way to emit named events. */
export interface RenderContext<TS = unknown, TC = unknown> {
  state: TS;
  config: TC;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  setConfig: (key: keyof TC, value: unknown) => void;
  trial: {
    id: string;
    /** The trial's view, in whatever shape this instrument chose. labkit persists
     *  it and restores it on Reset without ever reading into it. */
    view: unknown;
    setView: (next: unknown) => void;
    /** 2D convenience over `view`. Reads 1 and writes nothing when the trial holds
     *  a view that is not the 2D one. */
    zoom: number;
    setZoom: (z: number) => void;
    /** Resolved active tool: this trial's slot, or the lab's. Null when neither
     *  holds one. */
    activeToolId: string | null;
  };
  emit: (event: string) => void;
  /** Present only when the instrument declares a `job`. */
  job?: JobHandle;
}

/** One 2D canvas layer of an instrument, drawn in declaration order.
 *
 *  `draw` is called with the camera already applied, so it works in world
 *  coordinates. `zoom` is passed for the things that must not scale with it —
 *  set `ctx.lineWidth = 1 / zoom` to keep a hairline hairline. */
export interface CanvasLayer<TS = unknown, TC = unknown> {
  id: string;
  draw: (ctx: CanvasRenderingContext2D, args: { state: TS; config: TC; zoom: number }) => void;
}

/** Declares that an instrument draws to a canvas: its layers, and where the
 *  view starts. */
export interface CanvasCapability<TS = unknown, TC = unknown> {
  layers: CanvasLayer<TS, TC>[];
  initialView?: { zoom: number; pan: { x: number; y: number } };
  /** Widens `usePanZoom`'s default clamp; the opening zoom stays reachable
   *  regardless of these. */
  minZoom?: number;
  maxZoom?: number;
}

/** Declares which of an instrument's layers the trial should offer
 *  show/hide controls for. */
export interface LayerCapability {
  /** In list order. A bare string is a layer id that doubles as its own label;
   *  give a descriptor instead to label a layer or mark it `alwaysOn`. */
  ids: readonly (string | LayerDescriptor)[];
}

/** Declares that an instrument accepts items dragged from a palette: what the
 *  palette offers, what a drop does to the state, and — optionally — live
 *  feedback during the drag and the ability to drag existing items back out. */
export interface DragDropCapability<TS = unknown, TC = unknown> {
  palette: PaletteItem[] | ((state: TS, config: TC) => PaletteItem[]);
  onDrop: (worldPos: Point, item: PaletteItem, state: TS, config: TC) => TS;
  onDragOver?: (worldPos: Point, item: PaletteItem, state: TS, config: TC) => DragFeedback | null;
  pickUp?: (hit: HitResult, state: TS, config: TC) => { item: PaletteItem; state: TS } | null;
}

/** Declares that an instrument's state is undoable: which emitted events
 *  snapshot it, and how many snapshots to keep. */
export interface UndoCapability {
  snapshotOn?: string[];
  maxDepth?: number;
}

/** The name of an event an instrument emits through `RenderContext.emit`. */
export type SystemEvent = string;

/** A point in world coordinates. */
export type Point = { x: number; y: number };
/** What a hit-test found, and where. */
export type HitResult = { hit: boolean; layerId?: string; pointId?: string };
/** A trial's camera. */
export type ViewTransform = { zoom: number; pan: Point };
/** A layer as the layer list shows it. `alwaysOn` layers cannot be hidden. */
export type LayerDescriptor = { id: string; label: string; alwaysOn?: boolean };
/** One draggable entry in an instrument's palette. */
export type PaletteItem = { id: string; label: string; data?: unknown };
/** Whether a drop would be accepted at the current position, and why not if
 *  it would not. */
export type DragFeedback = { ok: boolean; reason?: string };

/**
 * An instrument: one self-contained interactive experiment a lab can host.
 *
 * It owns two pieces of data — `config`, the settings the control panel edits,
 * and `state`, what the experiment is currently doing — and renders from both.
 * The optional capability fields declare what else it wants from the runtime:
 * a canvas, a layer list, palette drag-and-drop, undo. Declaring a capability
 * is what makes the trial provide the corresponding chrome.
 */
export interface Instrument<TS = unknown, TC = unknown, TItem = unknown> {
  name: string;
  defaultConfig: () => TC;
  initialState: (config: TC) => TS;
  /** The instrument's config, declared once: values, types and controls.
   *  Supplying this makes `defaultConfig` optional — `defineInstrument`
   *  synthesizes it. Prefer it over `defaultConfig` + `configSchema`. */
  config?: ConfigSchema<TC>;
  /** @deprecated Declare `config` instead; this repeats what `TC` already
   *  says and nothing holds the two to one answer. */
  configSchema?: () => ConfigField[];
  /** The instrument's DOM. With `canvas`, this renders as an overlay above the
   *  layers rather than instead of them; return `null` for canvas only. */
  render: (ctx: RenderContext<TS, TC>) => ReactNode;
  onConfigChange?: (config: TC, prev: TC, state: TS) => TS;
  serialize?: (state: TS) => unknown;
  deserialize?: (data: unknown, config: TC) => TS;
  canvas?: CanvasCapability<TS, TC>;
  layers?: LayerCapability;
  dragDrop?: DragDropCapability<TS, TC>;
  undo?: UndoCapability;
  /** Tools this instrument offers. Declaring them gives the trial a palette
   *  region and its own tool slot. */
  tools?: ToolCapability;
  /** Chrome this instrument contributes beyond what its capabilities imply. */
  chrome?: TrialContribution[];
  /** Work too slow to do during a render. The runtime starts it, aborts it on
   *  unmount and on a `key` change, and renders progress into the trial. */
  job?: JobCapability<TS, TC, TItem>;
}

/** Instruments as a lab receives them. `any` rather than `unknown` because
 *  parameter contravariance keeps a `defineInstrument<TS, TC>` result out of
 *  an `Instrument<unknown, unknown>[]`; it is contained to this alias. */
// biome-ignore lint/suspicious/noExplicitAny: see above
export type InstrumentList = readonly Instrument<any, any, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any -- contravariant TC; see above
