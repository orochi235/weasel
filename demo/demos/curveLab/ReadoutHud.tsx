import { useMemo } from 'react';
import type { CurveRepresentation, SharedAnchor } from '../../../src/features/paths/curves';

interface ReadoutHudProps {
  rep: CurveRepresentation;
  anchors: SharedAnchor[];
}

interface CurveStats {
  anchorCount: number;
  segmentCount: number;
  maxAbsCurvature: number;
  rmsCurvature: number;
  arcLength: number;
}

function computeStats(rep: CurveRepresentation, anchors: SharedAnchor[]): CurveStats {
  const SAMPLES = 128;
  if (anchors.length < 2) {
    return { anchorCount: anchors.length, segmentCount: 0, maxAbsCurvature: 0, rmsCurvature: 0, arcLength: 0 };
  }
  let maxAbs = 0;
  let sumSq = 0;
  let arc = 0;
  let prev = rep.evaluate(anchors, 0);
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = rep.evaluate(anchors, t);
    arc += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    const k = Math.abs(rep.curvatureAt(anchors, t));
    if (k > maxAbs) maxAbs = k;
    sumSq += k * k;
  }
  const rms = Math.sqrt(sumSq / SAMPLES);
  const path = rep.toPath(anchors);
  let segs = 0;
  for (let i = 0; i < path.commands.length; i++) {
    const c = path.commands[i];
    if (c !== 0 && c !== 4) segs++;
  }
  return {
    anchorCount: anchors.length,
    segmentCount: segs,
    maxAbsCurvature: maxAbs,
    rmsCurvature: rms,
    arcLength: arc,
  };
}

export function ReadoutHud({ rep, anchors }: ReadoutHudProps) {
  const stats = useMemo(() => computeStats(rep, anchors), [rep, anchors]);
  return (
    <div className="curve-lab-readout">
      <span>anchors</span><span>{stats.anchorCount}</span>
      <span>segments</span><span>{stats.segmentCount}</span>
      <span>max |κ|</span><span>{stats.maxAbsCurvature.toFixed(4)}</span>
      <span>rms κ</span><span>{stats.rmsCurvature.toFixed(4)}</span>
      <span>length</span><span>{stats.arcLength.toFixed(1)}</span>
    </div>
  );
}
