import type { ReactNode } from 'react';

export type BadgeShape =
  | 'pill' | 'plain' | 'square' | 'notched' | 'perforated'
  | 'hexagon'
  | 'starburst' | 'scalloped' | 'shield' | 'ribbon' | 'beavis'
  | 'sparkler' | 'postage' | 'cloud' | 'house' | 'plaque'
  | 'crest' | 'urn' | 'coffin' | 'receipt' | 'wood' | 'quatrefoil';

export type BadgeTone =
  | 'accent' | 'info' | 'warn' | 'danger' | 'muted' | 'neutral' | 'custom';

export type BadgeVariant = 'outline' | 'solid' | 'subtle';
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
