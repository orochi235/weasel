import type { ViewTransform } from '../../instrument/types';
import { type Box, CONTENT, EXERCISES } from './exercises';

export const SCALES = ['0.5', '1', '2'] as const;
export const ZOOMS = ['1', '1.5', '3'] as const;
export type CalibrationScale = (typeof SCALES)[number];
export type CalibrationZoom = (typeof ZOOMS)[number];

/** What the calibration picture is drawn under: a scale, an optional scrolled pane, and a zoom onto one exercise. */
export interface CalibrationConfig {
  scale: CalibrationScale;
  scrolled: boolean;
  zoom: CalibrationZoom;
  /** The exercise a zoom above 1 centers on. */
  focus: string;
}

export const DEFAULT_CONDITION: CalibrationConfig = {
  scale: '1',
  scrolled: false,
  zoom: '1',
  focus: EXERCISES[0]?.id ?? '',
};

/** How much of the picture's height a scrolled pane shows, and how far down it starts. */
export const SCROLLED_SHOWS = 0.55;
export const SCROLLED_STARTS = 0.3;

/** Screen px per content unit. */
export function pxPerUnit(c: CalibrationConfig): number {
  return Number(c.scale) * Number(c.zoom);
}

/** The picture element's size on screen: the content at its scale. A zoom magnifies inside it. */
export function pictureSize(c: CalibrationConfig): { w: number; h: number } {
  const s = Number(c.scale);
  return { w: CONTENT.w * s, h: CONTENT.h * s };
}

/** The part of the content a zoom shows: `1 / zoom` of it, centered on the focused exercise and kept inside. */
export function zoomWindow(c: CalibrationConfig): Box {
  const z = Number(c.zoom);
  const w = CONTENT.w / z;
  const h = CONTENT.h / z;
  const area = EXERCISES.find((e) => e.id === c.focus)?.area ?? { x: 0, y: 0, ...CONTENT };
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  return { x: clamp(cx - w / 2, CONTENT.w - w), y: clamp(cy - h / 2, CONTENT.h - h), w, h };
}

/** The target's camera under a zoom, against its element's box; none at zoom 1, where labkit fits the content. */
export function targetView(c: CalibrationConfig): ViewTransform | undefined {
  if (c.zoom === '1') return undefined;
  const k = pxPerUnit(c);
  const win = zoomWindow(c);
  return { zoom: k, pan: { x: -win.x * k, y: -win.y * k } };
}
