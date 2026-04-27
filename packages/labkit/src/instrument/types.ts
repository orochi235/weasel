import type { ReactNode } from 'react';

export interface ConfigFieldBase {
  key: string;
  label: string;
  type: ConfigFieldType;
}

export type ConfigFieldType = 'slider' | 'checkbox' | 'select' | 'number' | 'text' | 'color';

export interface SliderField extends ConfigFieldBase {
  type: 'slider';
  default: number;
  min: number;
  max: number;
  step?: number;
}

export interface CheckboxField extends ConfigFieldBase {
  type: 'checkbox';
  default: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectField extends ConfigFieldBase {
  type: 'select';
  default: string;
  options: SelectOption[];
}

export interface NumberField extends ConfigFieldBase {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface TextField extends ConfigFieldBase {
  type: 'text';
  default: string;
  placeholder?: string;
  maxLength?: number;
  /** Milliseconds to debounce live setConfig calls. Default 150 ms. Set to 0 to disable. */
  debounceMs?: number;
}

export interface ColorField extends ConfigFieldBase {
  type: 'color';
  default: string;
}

export type ConfigField =
  | SliderField
  | CheckboxField
  | SelectField
  | NumberField
  | TextField
  | ColorField;

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
