import type { ReactNode } from 'react';

/**
 * Built-in badge silhouettes. `pill`, `plain` and `square` are drawn in CSS;
 * the rest are SVG outlines, several of which route through the compose
 * pipeline (a base shape plus perimeter effects).
 */
export type BadgeShape =
  | 'pill' | 'plain' | 'square' | 'notched' | 'perforated'
  | 'hexagon'
  | 'starburst' | 'scalloped' | 'shield' | 'ribbon' | 'beavis'
  | 'sparkler' | 'postage' | 'cloud' | 'house' | 'plaque'
  | 'crest' | 'urn' | 'coffin' | 'receipt' | 'wood' | 'quatrefoil';

/**
 * Semantic color of a badge. `custom` paints from the `--badge-edge` custom
 * property instead of a theme token, so a call site can supply its own color.
 */
export type BadgeTone =
  | 'accent' | 'info' | 'warn' | 'danger' | 'muted' | 'neutral' | 'custom';

/** How a badge's tone is applied: outline only, filled, or a soft tinted fill. */
export type BadgeVariant = 'outline' | 'solid' | 'subtle';
/** Badge type scale and padding step. */
export type BadgeSize = 'sm' | 'md';

export interface ShapeRenderProps<P = Record<string, never>> {
  variant: BadgeVariant;
  focused: boolean;
  params: P;
  /** 0..1 phase offset applied to perimeter patterns when the badge has `crawl` enabled. */
  phase: number;
}

export interface ShapeInsets { top: number; right: number; bottom: number; left: number }

/** Compose-mode descriptor a ShapeModule can produce to route rendering through base + effects.
 *  Strings reference the shape's BadgeBase/BadgeEffect keys; see bases/index.ts and effects/index.ts. */
export interface ShapeComposeSpec {
  base: string;
  baseParams?: Record<string, unknown>;
  effects?: { type: string; params?: Record<string, unknown> }[];
}

export interface ShapeModule<P = Record<string, never>> {
  /** Provide a Component for legacy SVG rendering OR a compose() returning a base+effects spec. At least one is required. */
  Component?: (props: ShapeRenderProps<P>) => ReactNode;
  compose?: (params: P) => ShapeComposeSpec;
  insets: ShapeInsets | ((params: P) => ShapeInsets);
  stretches: boolean;
  defaultAspect?: number;
  renderMode?: 'svg' | 'css';
  defaults?: P;
}
