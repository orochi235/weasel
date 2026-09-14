import { floorDegrees, type Constraints, type generate } from '@weasel-js/theme/engine';

/**
 * Which gates the best attempt still misses, and by how much.
 *
 * "Infeasible" on its own leaves you dragging sliders to find out which one
 * bound — and past about twenty colors more than one usually does.
 */
export function unmetGates(c: Constraints, stats: ReturnType<typeof generate>['stats']): string[] {
  const out: string[] = [];
  const floor = floorDegrees(c);
  if (floor > 0 && stats.minHueGap < floor - 0.01) {
    out.push(`hue gap reaches ${stats.minHueGap.toFixed(0)}° of the ${floor.toFixed(0)}° asked for`);
  }
  if (c.minContrast > 0 && stats.minContrast < c.minContrast) {
    out.push(`contrast reaches ${stats.minContrast.toFixed(2)} of ${c.minContrast.toFixed(1)}`);
  }
  if (c.minDistance > 0 && stats.minDistance < c.minDistance - 0.005) {
    out.push(`distance between colors reaches ${stats.minDistance.toFixed(3)} of ${c.minDistance.toFixed(2)}`);
  }
  if (c.minSurfaceDistance > 0 && stats.minSurfaceDistance < c.minSurfaceDistance - 0.005) {
    out.push(
      `distance from the surface reaches ${stats.minSurfaceDistance.toFixed(3)} of ${c.minSurfaceDistance.toFixed(2)}`,
    );
  }
  if (out.length > 0 && c.count * floor > 360) {
    out.push(`${c.count} hues ${floor.toFixed(0)}° apart would need ${(c.count * floor).toFixed(0)}° of circle`);
  }
  return out;
}
