import type { ReactNode } from 'react';

export type BadgeShape =
  | 'pill' | 'square' | 'notched' | 'perforated'
  | 'diamond' | 'dot' | 'hexagon' | 'chevron' | 'banner'
  | 'starburst' | 'scalloped' | 'shield' | 'ribbon';

export type BadgeTone =
  | 'accent' | 'info' | 'warn' | 'danger' | 'muted' | 'neutral';

export type BadgeVariant = 'outline' | 'solid' | 'subtle';
export type BadgeSize = 'sm' | 'md';

export interface ShapeRenderProps {
  variant: BadgeVariant;
  focused: boolean;
}

export interface ShapeModule {
  Component: (props: ShapeRenderProps) => ReactNode;
  insets: { top: number; right: number; bottom: number; left: number };
  stretches: boolean;
  defaultAspect?: number;
}
