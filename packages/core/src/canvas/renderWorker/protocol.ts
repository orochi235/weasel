/**
 * The messages between a page and its render worker. Nothing here is consumer surface: a page
 * speaks it through `startSceneRenderWorker`, a worker through `serveSceneRender`.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import type { SerializedNode, SerializedScene } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import type { IdBuffer, ImageRasterSize } from '@weasel-js/renderer';

/** A node as it crosses: its saved form, function fields as registry keys. */
export type WireNode = SerializedNode<unknown, string, unknown>;

/** What changed in the scene since the last frame. `reset` replaces the worker's copy whole;
 *  otherwise `nodes` holds every node added or changed, in tree preorder, `removed` the ids
 *  gone, and `order` the whole preorder whenever it moved. */
export interface SceneDelta {
  reset?: SerializedScene<unknown, string, unknown>;
  nodes?: WireNode[];
  removed?: string[];
  order?: string[];
  /** The page's `scenePickIds` number of each node the worker has not been told one for, so its
   *  id frames name nodes as the page does. */
  pickIds?: [string, number][];
}

/** One pose override as it crosses. `data` is what the override's function answered for the
 *  node's stored data, present when the override has one. */
export interface WireOverride {
  id: string;
  pose?: unknown;
  alpha?: number;
  path?: unknown;
  shows?: boolean;
  data?: unknown;
}

/** A container's scroll offset as it crosses. */
export interface WireScroll {
  id: string;
  x: number;
  y: number;
  z?: number;
}

/** A call on the worker's animator, made on the page. `play` runs the program the worker module
 *  registered under `key`; `id` names what it started, for the calls on that one. */
export type AnimationOp =
  | { op: 'play'; id: number; key: string; params?: unknown }
  | { op: 'cancel' | 'pause' | 'resume'; id: number }
  | { op: 'scale'; id: number; scale: number }
  | { op: 'cancelKey' | 'pauseKey' | 'resumeKey'; key: string }
  | { op: 'cancelAll' | 'pauseAll' | 'resumeAll' }
  | { op: 'scaleAll'; scale: number };

/** Where the worker's animator stands this frame: the page's frame time, or a page clock's
 *  position and rate, which it follows backward as well as forward. */
export type FrameTime = { time: number } | { elapsed: number; rate: number };

/** Everything a frame reads beside the scene, each field present only when it changed. */
export interface FrameInputs {
  view?: View;
  size?: { width: number; height: number; dpr: number };
  layers?: { layerVisibility?: Record<string, boolean>; layerOrder?: readonly string[] };
  cull?: boolean;
  /** `null` clears them. */
  extraCommands?: DrawCommand[] | null;
  /** Every scrolled container, whenever any scroll changed. */
  scroll?: WireScroll[];
  /** Each node whose `alphaFor` changed, with its new alpha; an alpha of 1 drops the entry. */
  alpha?: [string, number][];
  /** Sent every frame. */
  at?: FrameTime;
  /** The page's frames are back after time nobody saw. */
  resumed?: true;
  animations?: AnimationOp[];
}

export type ToWorker =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; dpr: number }
  | ({ type: 'frame'; scene?: SceneDelta; overrides?: WireOverride[] } & FrameInputs)
  | { type: 'snapshot'; id: number }
  /** The answer to the worker's `image` request of the same `id`. */
  | { type: 'image'; id: number; src: string; bitmap?: ImageBitmap; error?: string }
  /** The ids the last frame painted over `rect`, CSS pixels from the canvas's top-left. */
  | { type: 'readIds'; id: number; rect: IdRect; minAlpha?: number; exclude?: number[] };

/** A rectangle of the canvas, CSS pixels from its top-left. */
export interface IdRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FromWorker =
  /** A frame landed. */
  | { type: 'drawn' }
  /** Something the worker owns changed its pixels: an image or glyph landed, or a lost context
   *  came back. The page schedules a frame. */
  | { type: 'dirty' }
  /** The worker cannot load `src` itself. */
  | { type: 'image'; id: number; src: string; size?: ImageRasterSize }
  | { type: 'snapshot'; id: number; bitmap: ImageBitmap | null }
  | { type: 'ids'; id: number; ids: IdBuffer }
  | { type: 'error'; message: string };
