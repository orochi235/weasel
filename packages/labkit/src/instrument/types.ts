import type { ReactNode } from 'react';
import type { ConfigField } from '../controls/types';

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

export interface CanvasLayer<TS = unknown, TC = unknown> {
  id: string;
  draw: (ctx: CanvasRenderingContext2D, args: { state: TS; config: TC; zoom: number }) => void;
}

export interface CanvasCapability<TS = unknown, TC = unknown> {
  layers: CanvasLayer<TS, TC>[];
  initialView?: { zoom: number; pan: { x: number; y: number } };
}

export interface LayerCapability {
  ids: string[];
}

export interface DragDropCapability<TS = unknown, TC = unknown> {
  onDrop?: (args: { state: TS; config: TC; data: unknown }) => TS;
}

export interface UndoCapability {
  snapshotOn?: string[];
  maxDepth?: number;
}

export type SystemEvent = string;

export type Point = { x: number; y: number };
export type HitResult = { hit: boolean; layerId?: string; pointId?: string };
export type ViewTransform = { zoom: number; pan: Point };
export type LayerDescriptor = { id: string; label: string; alwaysOn?: boolean };
export type PaletteItem = { id: string; label: string; data?: unknown };
export type DragFeedback = { ok: boolean; reason?: string };

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
