/**
 * The messages between a page and its render worker. Nothing here is consumer surface: a page
 * speaks it through `startSceneRenderWorker`, a worker through `serveSceneRender`.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import type { SerializedNode, SerializedScene } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import type { ImageRasterSize } from '@weasel-js/renderer';

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

/** Everything a frame reads beside the scene, each field present only when it changed. */
export interface FrameInputs {
  view?: View;
  size?: { width: number; height: number; dpr: number };
  layers?: { layerVisibility?: Record<string, boolean>; layerOrder?: readonly string[] };
  cull?: boolean;
  /** `null` clears them. */
  extraCommands?: DrawCommand[] | null;
}

export type ToWorker =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; dpr: number }
  | ({ type: 'frame'; scene?: SceneDelta; overrides?: WireOverride[] } & FrameInputs)
  | { type: 'snapshot'; id: number }
  | { type: 'image'; src: string; bitmap?: ImageBitmap; error?: string };

export type FromWorker =
  /** A frame landed. */
  | { type: 'drawn' }
  /** Something the worker owns changed its pixels: an image or glyph landed, or a lost context
   *  came back. The page schedules a frame. */
  | { type: 'dirty' }
  /** The worker cannot load `src` itself. */
  | { type: 'image'; src: string; size?: ImageRasterSize }
  | { type: 'snapshot'; id: number; bitmap: ImageBitmap | null }
  | { type: 'error'; message: string };
