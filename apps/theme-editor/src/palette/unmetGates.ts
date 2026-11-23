import { floorDegrees, type Constraints, type generate } from '@weasel-js/theme/engine';

export type Stats = ReturnType<typeof generate>['stats'];

/** Whether `stats` clears a distance or contrast gate; undefined for a gate set to 0, which is off. */
export function gateVerdict(c: Constraints, stats: Stats, gate: 'minContrast' | 'minDistance' | 'minSurfaceDistance'): 'ok' | 'bad' | undefined {
  if (!(c[gate] > 0)) return undefined;
  // Contrast is compared exactly; distances get the slack their three printed decimals cannot show.
  const slack = gate === 'minContrast' ? 0 : 0.005;
  return stats[gate] < c[gate] - slack ? 'bad' : 'ok';
}

/**
 * Which gates the best attempt still misses, and by how much.
 *
 * "Infeasible" on its own leaves you dragging sliders to find out which one
 * bound — and past about twenty colors more than one usually does.
 */
export function unmetGates(c: Constraints, stats: Stats): string[] {
  // The generator drops anchors past `count` and never searches, so no gate is to blame.
  const over = c.anchors.length - c.count;
  if (over > 0) {
    return [`${c.anchors.length} colors are pinned for ${c.count}: add ${over} more ${over === 1 ? 'color' : 'colors'} or unpin ${over}`];
  }
  const out: string[] = [];
  const floor = floorDegrees(c);
  if (floor > 0 && stats.minHueGap < floor - 0.01) {
    out.push(`hue gap reaches ${stats.minHueGap.toFixed(0)}° of the ${floor.toFixed(0)}° asked for`);
  }
  if (gateVerdict(c, stats, 'minContrast') === 'bad') {
    out.push(`contrast reaches ${stats.minContrast.toFixed(2)} of ${c.minContrast.toFixed(1)}`);
  }
  if (gateVerdict(c, stats, 'minDistance') === 'bad') {
    out.push(`distance between colors reaches ${stats.minDistance.toFixed(3)} of ${c.minDistance.toFixed(2)}`);
  }
  if (gateVerdict(c, stats, 'minSurfaceDistance') === 'bad') {
    out.push(
      `distance from the surface reaches ${stats.minSurfaceDistance.toFixed(3)} of ${c.minSurfaceDistance.toFixed(2)}`,
    );
  }
  if (out.length > 0 && c.count * floor > 360) {
    out.push(`${c.count} hues ${floor.toFixed(0)}° apart would need ${(c.count * floor).toFixed(0)}° of circle`);
  }
  return out;
}
