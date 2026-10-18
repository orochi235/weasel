import type { SnapMark } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { projectPoint, type Viewport3d } from '../project';

type Point = { x: number; y: number };

/** A snap mark's segment on screen: a line, a gap, or a distance. */
export interface ScreenLine {
  from: Point;
  to: Point;
  /** A gap's or distance's value, in world units. */
  value?: number;
  color?: string;
}

/** A snap mark's point on screen. */
export interface ScreenPoint {
  at: Point;
  glyph: string;
  label?: string;
  color?: string;
}

/**
 * The marks a 3D snap session draws, in the viewport's screen space, for a
 * host to draw through its own renderer. A mark with any point that does not
 * project — behind the camera — is dropped whole.
 */
export function projectSnapMarks(
  marks: readonly SnapMark<Vec3>[], viewport: Viewport3d,
): { lines: ScreenLine[]; points: ScreenPoint[] } {
  const lines: ScreenLine[] = [];
  const points: ScreenPoint[] = [];
  for (const m of marks) {
    if (m.kind === 'point') {
      const at = projectPoint(m.at, viewport);
      if (at) {
        points.push({
          at, glyph: m.glyph,
          ...(m.label !== undefined ? { label: m.label } : {}),
          ...(m.color ? { color: m.color } : {}),
        });
      }
      continue;
    }
    const from = projectPoint(m.from, viewport);
    const to = projectPoint(m.to, viewport);
    if (!from || !to) continue;
    lines.push({
      from, to,
      ...('value' in m ? { value: m.value } : {}),
      ...(m.color ? { color: m.color } : {}),
    });
  }
  return { lines, points };
}
