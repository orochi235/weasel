import type { ReactNode } from 'react';
import type { ConfigField } from '../controls/types';

/** What an instrument's `render` is handed: its state and config, the setters
 *  for both, the workspace it is mounted in, and a way to emit named events. */
export interface RenderContext<TS = unknown, TC = unknown> {
  state: TS;
  config: TC;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  setConfig: (key: keyof TC, value: unknown) => void;
  workspace: {
    id: string;
    zoom: number;
    setZoom: (z: number) => void;
  };
  emit: (event: string) => void;
}

/** One 2D canvas layer of an instrument, drawn in declaration order. */
export interface CanvasLayer<TS = unknown, TC = unknown> {
  id: string;
  draw: (ctx: CanvasRenderingContext2D, args: { state: TS; config: TC; zoom: number }) => void;
}

/** Declares that an instrument draws to a canvas: its layers, and where the
 *  view starts. */
export interface CanvasCapability<TS = unknown, TC = unknown> {
  layers: CanvasLayer<TS, TC>[];
  initialView?: { zoom: number; pan: { x: number; y: number } };
}

/** Declares which of an instrument's layers the workspace should offer
 *  show/hide controls for. */
export interface LayerCapability {
  ids: string[];
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
/** A workspace's camera. */
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
 * is what makes the workspace provide the corresponding chrome.
 */
export interface Instrument<TS = unknown, TC = unknown> {
  name: string;
  defaultConfig: () => TC;
  initialState: (config: TC) => TS;
  configSchema?: () => ConfigField[];
  render: (ctx: RenderContext<TS, TC>) => ReactNode;
  onConfigChange?: (config: TC, prev: TC, state: TS) => TS;
  serialize?: (state: TS) => unknown;
  deserialize?: (data: unknown, config: TC) => TS;
  canvas?: CanvasCapability<TS, TC>;
  layers?: LayerCapability;
  dragDrop?: DragDropCapability<TS, TC>;
  undo?: UndoCapability;
}
