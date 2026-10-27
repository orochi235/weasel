/**
 * A text node as a path effect's items: its first line's grapheme clusters,
 * each one's outlines and decoration rules in its own frame, sized as the node
 * draws them.
 */
import { poseFrameOf, transformPath, type Affine, type PathInWorldPose } from '@weasel-js/geom';
import {
  loadTextOutlines, textClusters, TextOutlinesError, type TextCluster, type TextOutlineSource,
} from '@weasel-js/text';
import { noteFontRead } from 'core/scene/fontReads';
import type { EffectItem } from 'core/scene/pathEffects/source';

/**
 * The clusters of `data`'s first line as items, laid in `pose`'s box width.
 * The pose's scale grows them; its rotation and skew are dropped, since the
 * path an effect lays them along decides their turn. `[]` while a face's
 * outlines are loading — the load is started, and the font read is noted so
 * the derivation re-runs once it lands.
 */
export function textEffectItems(data: TextOutlineSource, pose: PathInWorldPose): readonly EffectItem[] {
  noteFontRead();
  let clusters: TextCluster[];
  try {
    clusters = textClusters(data, { width: pose.width });
  } catch (err) {
    if (!(err instanceof TextOutlinesError)) throw err;
    loadTextOutlines(data).catch(() => {});
    return [];
  }
  const k = scaleOf(pose);
  const grow: Affine | null = k === 1 ? null : [k, 0, 0, k, 0, 0];
  return clusters.map((c) => ({
    length: c.advance * k,
    middle: c.middle * k,
    parts: c.paths.map((p) => ({
      path: grow === null ? p.path : transformPath(p.path, grow),
      fill: p.fill,
      stroke: p.stroke ?? null,
    })),
    bands: c.rules.map((r) => ({
      x0: r.x0 * k, x1: r.x1 * k, y0: r.y0 * k, y1: r.y1 * k, fill: r.fill, stroke: r.stroke ?? null,
    })),
  }));
}

function scaleOf(pose: PathInWorldPose): number {
  const m = poseFrameOf(pose);
  return m === null ? 1 : Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}
