import type { ReactNode } from 'react';
import type { TrackCtx } from './RangePicker';

export type GradientTrackOpts = {
  gradient: (t: number) => string;
  samples?: number;
  activeRange?: [number, number];
  hatch?: {
    angleDeg?: number;
    stripe?: number;
    gap?: number;
    dim?: number;
  };
};

export function paintGradientTrack(_opts: GradientTrackOpts): (ctx: TrackCtx) => ReactNode {
  void _opts;
  return () => null;
}
