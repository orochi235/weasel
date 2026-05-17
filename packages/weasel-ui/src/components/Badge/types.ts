import type { ReactNode } from 'react';

export type BadgeShape =
  | 'pill' | 'plain' | 'square' | 'notched' | 'perforated'
  | 'hexagon'
  | 'starburst' | 'scalloped' | 'shield' | 'ribbon' | 'beavis'
  | 'sparkler' | 'postage' | 'cloud' | 'house' | 'plaque'
  | 'bat' | 'crest' | 'urn' | 'coffin' | 'receipt' | 'wood' | 'leaves';

export type BadgeTone =
  | 'accent' | 'info' | 'warn' | 'danger' | 'muted' | 'neutral';

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

export interface ShapeModule<P = Record<string, never>> {
  Component: (props: ShapeRenderProps<P>) => ReactNode;
  insets: ShapeInsets | ((params: P) => ShapeInsets);
  stretches: boolean;
  defaultAspect?: number;
  renderMode?: 'svg' | 'css';
  defaults?: P;
}
