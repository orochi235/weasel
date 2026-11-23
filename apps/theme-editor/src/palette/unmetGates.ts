import { floorDegrees, hueGap, toHexPreview, toLch, type Constraints, type generate } from '@weasel-js/theme/engine';

export type Stats = ReturnType<typeof generate>['stats'];

/** Whether `stats` clears a distance or contrast gate; undefined for a gate set to 0, which is off. */
export function gateVerdict(c: Constraints, stats: Stats, gate: 'minContrast' | 'minDistance' | 'minSurfaceDistance'): 'ok' | 'bad' | undefined {
  if (!(c[gate] > 0)) return undefined;
  // Exact, as the generator's own check is: any slack here calls a gate met beside a palette marked infeasible.
  return stats[gate] < c[gate] ? 'bad' : 'ok';
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
  const pinned = floor > 0 ? closestPins(c) : undefined;
  if (pinned && pinned.gap < floor - 0.01) {
    out.push(`pinned ${pinned.names[0]} and ${pinned.names[1]} sit ${pinned.gap.toFixed(0)}° apart, so no hue gap can reach ${floor.toFixed(0)}°`);
  }
  return out;
}

/** The two anchors nearest in hue, measured as the generator places them. */
function closestPins(c: Constraints): { gap: number; names: [string, string] } | undefined {
  const hues = c.anchors.map((a) => toLch(toHexPreview(a)).H);
  let best: { gap: number; names: [string, string] } | undefined;
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      const gap = hueGap(hues[i], hues[j]);
      if (!best || gap < best.gap) best = { gap, names: [c.anchors[i].name, c.anchors[j].name] };
    }
  }
  return best;
}
